using Microsoft.Data.Sqlite;

namespace Macofu;

public record StoredOrder(string Id, string TraceId, string CreatedAt);

public sealed class OrderStore : IDisposable
{
    private readonly SqliteConnection connection;

    public OrderStore()
    {
        SQLitePCL.Batteries_V2.Init();
        // A private SQLite database lives as long as this learner's factory.
        connection = new SqliteConnection("Data Source=:memory:;Pooling=False");
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, created_at TEXT NOT NULL)";
        command.ExecuteNonQuery();
    }

    public void Insert(OrderMessage order)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO orders (id, trace_id, created_at) VALUES ($id, $trace, $time)";
        command.Parameters.AddWithValue("$id", order.Id);
        command.Parameters.AddWithValue("$trace", order.TraceId);
        command.Parameters.AddWithValue("$time", DateTimeOffset.UtcNow.ToString("O"));
        command.ExecuteNonQuery();
    }

    public StoredOrder[] All()
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT id, trace_id, created_at FROM orders ORDER BY created_at DESC";
        using var reader = command.ExecuteReader();
        var result = new List<StoredOrder>();
        while (reader.Read()) result.Add(new(reader.GetString(0), reader.GetString(1), reader.GetString(2)));
        return result.ToArray();
    }

    public void Clear()
    {
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM orders";
        command.ExecuteNonQuery();
    }

    public void Dispose() => connection.Dispose();
}
