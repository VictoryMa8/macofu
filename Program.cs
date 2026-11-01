using Macofu;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<Lab>();
builder.Services.AddHostedService<OrderWorker>();
var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/state", (Lab lab) => lab.Snapshot());

// Accepting work and finishing work are two different events.
app.MapPost("/api/orders", (Lab lab) =>
{
    var result = lab.AcceptOrder();
    return Results.Json(new
    {
        orderId = result.Order.Id,
        traceId = result.Order.TraceId,
        route = result.Route,
        status = result.Status
    }, statusCode: result.StatusCode);
});

app.MapGet("/api/orders/{id}", (string id, Lab lab) =>
    lab.FindOrder(id) is { } order ? Results.Ok(order) : Results.NotFound());

app.MapPost("/api/worker/{action}", (string action, Lab lab) =>
{
    if (action is not ("pause" or "resume")) return Results.BadRequest();
    lab.SetPaused(action == "pause");
    return Results.Ok(lab.Snapshot());
});

app.MapPost("/api/reset", (Lab lab) =>
{
    lab.Reset();
    return Results.Ok(lab.Snapshot());
});

app.MapPost("/api/missions/{id}", (string id, Lab lab) =>
{
    if (id is not ("rush-hour" or "missing-order")) return Results.BadRequest();
    lab.StartMission(id);
    return Results.Ok(lab.Snapshot());
});

app.MapGet("/api/journeys/{id}", (string id, Lab lab) =>
    lab.FindJourney(id) is { } journey ? Results.Ok(journey) : Results.NotFound());

app.MapPost("/api/route/{route}", (string route, Lab lab) =>
{
    if (route is not ("direct" or "queue")) return Results.BadRequest();
    lab.SetRoute(route);
    return Results.Ok(lab.Snapshot());
});

app.MapPost("/api/database/{action}", (string action, Lab lab) =>
{
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
