using Macofu;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<LearnerLabs>();
builder.Services.AddScoped<LearnerSession>();
builder.Services.AddHostedService<OrderWorker>();
var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();

app.Use(async (context, next) =>
{
    if (!context.Request.Path.StartsWithSegments("/api") ||
        context.Request.Path.StartsWithSegments("/api/source"))
    {
        await next(context);
        return;
    }

    context.Response.Headers.CacheControl = "no-store";
    var cookie = context.Request.Cookies[LearnerLabs.CookieName];
    using var lease = context.RequestServices.GetRequiredService<LearnerLabs>().Acquire(cookie);
    if (lease is null)
    {
        context.Response.Headers.RetryAfter = "60";
        await Results.Json(new { error = "The lab is busy. Please try again shortly." }, statusCode: 503)
            .ExecuteAsync(context);
        return;
    }
    if (cookie != lease.Id)
        context.Response.Cookies.Append(LearnerLabs.CookieName, lease.Id, new CookieOptions
        {
            HttpOnly = true,
            // Fly terminates HTTPS before forwarding to the app. This header can
            // only tighten the cookie policy; it never grants access to a lab.
            Secure = context.Request.IsHttps || context.Request.Headers["X-Forwarded-Proto"] == "https",
            SameSite = SameSiteMode.Strict,
            IsEssential = true,
            Path = "/api"
        });
    context.RequestServices.GetRequiredService<LearnerSession>().Lab = lease.Lab;
    await next(context);
});

// Hosting probes must not allocate anonymous learner factories.
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/state", (LearnerSession learner) => learner.Lab.Snapshot());

// Accepting work and finishing work are two different events.
app.MapPost("/api/orders", (LearnerSession learner) =>
{
    var lab = learner.Lab;
    var result = lab.AcceptOrder();
    return Results.Json(new
    {
        orderId = result.Order.Id,
        traceId = result.Order.TraceId,
        route = result.Route,
        status = result.Status
    }, statusCode: result.StatusCode);
});

app.MapGet("/api/orders/{id}", (string id, LearnerSession learner) =>
    learner.Lab.FindOrder(id) is { } order ? Results.Ok(order) : Results.NotFound());

app.MapPost("/api/worker/{action}", (string action, LearnerSession learner) =>
{
    var lab = learner.Lab;
    if (action is not ("pause" or "resume")) return Results.BadRequest();
    lab.SetPaused(action == "pause");
    return Results.Ok(lab.Snapshot());
});

app.MapPost("/api/reset", (LearnerSession learner) =>
{
    var lab = learner.Lab;
    lab.Reset();
    return Results.Ok(lab.Snapshot());
});

app.MapPost("/api/missions/{id}", (string id, LearnerSession learner) =>
{
    var lab = learner.Lab;
    if (id is not ("rush-hour" or "missing-order")) return Results.BadRequest();
    lab.StartMission(id);
    return Results.Ok(lab.Snapshot());
});

app.MapGet("/api/journeys/{id}", (string id, LearnerSession learner) =>
    learner.Lab.FindJourney(id) is { } journey ? Results.Ok(journey) : Results.NotFound());

app.MapPost("/api/route/{route}", (string route, LearnerSession learner) =>
{
    var lab = learner.Lab;
    if (route is not ("direct" or "queue")) return Results.BadRequest();
    lab.SetRoute(route);
    return Results.Ok(lab.Snapshot());
});

app.MapPost("/api/database/{action}", (string action, LearnerSession learner) =>
{
    var lab = learner.Lab;
    if (action is not ("online" or "offline")) return Results.BadRequest();
    lab.SetDatabaseOnline(action == "online");
    return Results.Ok(lab.Snapshot());
});

// The inspector displays these exact files, not separate example snippets.
app.MapGet("/api/source/{name}", (string name, IWebHostEnvironment env) =>
{
    var relative = name switch
    {
        "handler" => "Program.cs",
        "queue" => "Lab.cs",
        "worker" => "OrderWorker.cs",
        "database" => "OrderStore.cs",
        _ => null
    };
    return relative is null ? Results.NotFound() :
        Results.Text(File.ReadAllText(Path.Combine(env.ContentRootPath, relative)), "text/plain");
});

app.Run();
