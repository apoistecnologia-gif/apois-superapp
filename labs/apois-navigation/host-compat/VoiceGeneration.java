package br.com.apois.navigation.compat.lab;

// Access only on the main looper. An old delayed callback can never speak
// after a stop or an interrupting request has advanced this generation.
final class VoiceGeneration {
    private long generation;
    private boolean closed;
    long ticket() { return generation; }
    boolean accepts(long ticket) { return !closed && ticket == generation; }
    void invalidate() { generation++; }
    void close() { invalidate(); closed = true; }
}
