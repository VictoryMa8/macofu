using System.Security.Cryptography;

namespace Macofu;

// Only this request's factory is exposed to the lesson endpoints.
public sealed class LearnerSession
{
    public Lab Lab { get; internal set; } = null!;
}

public sealed class LearnerLabs : IDisposable
{
    public const string CookieName = "macofu-learner";
    private readonly object gate = new();
    private readonly Dictionary<string, Entry> entries = new(StringComparer.Ordinal);
    private readonly TimeProvider clock;
    private readonly TimeSpan idleTimeout;
    private readonly int maxSessions;

    public LearnerLabs(TimeProvider clock, IConfiguration configuration)
    {
        this.clock = clock;
        idleTimeout = configuration.GetValue("LearnerSessions:IdleTimeout", TimeSpan.FromHours(2));
        maxSessions = configuration.GetValue("LearnerSessions:MaxSessions", 1000);
        if (idleTimeout <= TimeSpan.Zero || maxSessions <= 0)
            throw new InvalidOperationException("Learner session timeout and capacity must be positive.");
    }

    public Lease? Acquire(string? cookie)
    {
        lock (gate)
        {
            var now = clock.GetUtcNow();
            RemoveExpired(now);
            // Unknown or expired cookies never choose the identity of a new session.
            if (cookie is null || !entries.TryGetValue(cookie, out var entry))
            {
                if (entries.Count >= maxSessions) return null;
                cookie = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
                entry = new Entry(new Lab(), now);
                entries.Add(cookie, entry);
            }
            entry.Requests++;
            entry.LastAccess = now;
            return new Lease(cookie, entry.Lab, () => Release(entry));
        }
    }

    public void ProcessNext()
    {
        lock (gate)
        {
            RemoveExpired(clock.GetUtcNow());
            // Each factory has its own queue, worker controls, and SQLite connection.
            foreach (var entry in entries.Values) entry.Lab.ProcessNext();
        }
    }

    private void Release(Entry entry)
    {
        lock (gate)
        {
            entry.Requests--;
            entry.LastAccess = clock.GetUtcNow();
        }
    }

    private void RemoveExpired(DateTimeOffset now)
    {
        foreach (var (id, entry) in entries.ToArray())
        {
            if (entry.Requests != 0 || now - entry.LastAccess < idleTimeout) continue;
            entries.Remove(id);
            entry.Lab.Dispose();
        }
    }

    public void Dispose()
    {
        lock (gate)
        {
            foreach (var entry in entries.Values) entry.Lab.Dispose();
            entries.Clear();
        }
    }

    private sealed class Entry(Lab lab, DateTimeOffset lastAccess)
    {
        public Lab Lab { get; } = lab;
        public DateTimeOffset LastAccess { get; set; } = lastAccess;
        public int Requests { get; set; }
    }

    public sealed class Lease(string id, Lab lab, Action release) : IDisposable
    {
        private Action? release = release;
        public string Id { get; } = id;
        public Lab Lab { get; } = lab;
        public void Dispose() => Interlocked.Exchange(ref release, null)?.Invoke();
    }
}
