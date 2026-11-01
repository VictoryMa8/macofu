namespace Macofu;

public record OrderMessage(string Id, string TraceId);
public record OrderResult(OrderMessage Order, int StatusCode, string Route, string Status);
public record TraceEvent(long Sequence, string Time, string TraceId, string Component, string Kind, string Message);

// The queue is local and in-memory. The outage is deliberate fault injection.
public sealed class Lab : IDisposable
{
    private readonly object gate = new();
    private readonly Queue<OrderMessage> queue = new();
    private readonly List<TraceEvent> events = new();
    private readonly List<string> protectedOrders = new();
    private readonly Dictionary<string, OrderResult> receipts = new();
    private readonly Dictionary<string, List<TraceEvent>> journeys = new();
    private readonly OrderStore store;
    private bool paused;
    private bool databaseOnline;
    private string route = "direct";
    private int rejected;
    private long sequence;
    private string missionId = "rush-hour";
    private string? missingOrderId;

    public Lab(IWebHostEnvironment environment)
    {
        store = new OrderStore(environment.ContentRootPath);
        store.Clear();
    }

    public OrderResult AcceptOrder()
    {
        lock (gate)
        {
            var order = new OrderMessage(Guid.NewGuid().ToString("N")[..8], Guid.NewGuid().ToString("N")[..8]);
            Record(order, "handler", "request", "POST /api/orders reached the ASP.NET handler.");
            if (route == "direct")
            {
                if (!databaseOnline)
                {
                    rejected++;
                    Record(order, "database", "rejected", "Direct write failed: database outage. HTTP 503; no order was saved or queued.");
                    return Receipt(order, 503, "database_unavailable");
                }
                store.Insert(order);
                Record(order, "database", "saved", $"Direct INSERT committed for order {order.Id}. HTTP 201 Created.");
                return Receipt(order, 201, "saved");
            }
            if (queue.Count >= 30)
            {
                Record(order, "queue", "rejected", "Queue capacity reached. HTTP 429; order was not accepted.");
                return Receipt(order, 429, "queue_full");
            }
            queue.Enqueue(order);
            if (!databaseOnline && protectedOrders.Count < 3) protectedOrders.Add(order.Id);
            Record(order, "queue", "enqueued", $"Order {order.Id} enqueued. Depth: {queue.Count}.");
            Record(order, "handler", "accepted", "HTTP 202 Accepted. The order is queued, not yet saved.");
            return Receipt(order, 202, "accepted");
        }
    }

    public void ProcessNext()
    {
        lock (gate)
        {
            // Failed database dependencies do not discard queued work.
            if (paused || !databaseOnline || !queue.TryPeek(out var order)) return;
            Record(order, "worker", "consumed", $"Worker received order {order.Id}.");
            store.Insert(order);
            queue.Dequeue();
            Record(order, "database", "saved", $"INSERT committed for order {order.Id}.");
            Record(order, "worker", "completed", "Message completed. Order is available to read.");
        }
    }

    public void SetPaused(bool value)
    {
        lock (gate)
        {
            paused = value;
            Control("worker", value ? "Worker paused." : "Worker started.");
        }
    }

    public void SetDatabaseOnline(bool value)
    {
        lock (gate)
        {
            databaseOnline = value;
            Control("database", value ? "Database restored. Writes are available." : "Database outage injected. Writes are unavailable.");
        }
    }

    public void SetRoute(string value)
    {
        lock (gate)
        {
            route = value;
            Control("handler", value == "queue" ? "API now enqueues orders and returns 202." : "API now writes directly to the database.");
        }
    }

    public object Snapshot()
    {
        lock (gate)
        {
            var orders = store.All();
            var delivered = protectedOrders.Count(id => orders.Any(order => order.Id == id));
            var missingDelivered = missingOrderId is not null && orders.Any(order => order.Id == missingOrderId);
            return new { paused, databaseOnline, route, rejected, queue = queue.ToArray(), orders,
                mission = new { id = missionId, targetOrderId = missingOrderId,
                    protectedCount = protectedOrders.Count, delivered = missionId == "missing-order" ? (missingDelivered ? 1 : 0) : delivered,
                    target = missionId == "missing-order" ? 1 : 3,
                    protectedIds = protectedOrders.ToArray(), complete = missionId == "missing-order" ? missingDelivered : protectedOrders.Count == 3 && delivered == 3 },
                events = events.TakeLast(100).ToArray() };
        }
    }

    public StoredOrder? FindOrder(string id)
    {
        lock (gate) return store.All().FirstOrDefault(order => order.Id == id);
    }

    public object? FindJourney(string id)
    {
        lock (gate)
        {
            if (!receipts.TryGetValue(id, out var receipt)) return null;
            var saved = store.All().Any(order => order.Id == id);
            var queued = queue.Any(order => order.Id == id);
            return new { orderId = id, traceId = receipt.Order.TraceId, httpStatus = receipt.StatusCode,
                receipt.Route, location = saved ? "database" : queued ? "queue" : "rejected",
                paused, databaseOnline, events = journeys[receipt.Order.TraceId].ToArray() };
        }
    }

    public void StartMission(string id)
    {
        lock (gate)
        {
            missionId = id;
            Reset();
        }
    }

    public void Reset()
    {
        lock (gate)
        {
            paused = false;
            databaseOnline = false;
            route = "direct";
            rejected = 0;
            queue.Clear();
            protectedOrders.Clear();
            receipts.Clear();
            journeys.Clear();
            missingOrderId = null;
            events.Clear();
            store.Clear();
            sequence = 0;
            if (missionId == "missing-order")
            {
                databaseOnline = true;
                paused = true;
                route = "queue";
                missingOrderId = AcceptOrder().Order.Id;
            }
        }
    }

    private void Control(string component, string message) =>
        events.Add(new(++sequence, DateTimeOffset.UtcNow.ToString("HH:mm:ss.fff"), "control", component, "control", message));

    private void Record(OrderMessage order, string component, string kind, string message)
    {
        var entry = new TraceEvent(++sequence, DateTimeOffset.UtcNow.ToString("HH:mm:ss.fff"), order.TraceId, component, kind, message);
        events.Add(entry);
        if (!journeys.TryGetValue(order.TraceId, out var journey)) journeys[order.TraceId] = journey = new();
        journey.Add(entry);
        if (events.Count > 200) events.RemoveRange(0, events.Count - 200);
    }

    private OrderResult Receipt(OrderMessage order, int statusCode, string status)
    {
        var receipt = new OrderResult(order, statusCode, route, status);
        receipts.Add(order.Id, receipt);
        return receipt;
    }

    public void Dispose() => store.Dispose();
}
