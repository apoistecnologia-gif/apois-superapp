package br.com.apois.navigation.compat.lab;

public final class VoiceGenerationTest {
    private static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    public static void main(String[] args) {
        VoiceGeneration g = new VoiceGeneration();
        long a = g.ticket(), b = g.ticket();
        check(g.accepts(a) && g.accepts(b));
        g.invalidate();
        check(!g.accepts(a) && !g.accepts(b));
        long c = g.ticket();
        check(g.accepts(c));
        g.invalidate();
        check(!g.accepts(c));
        long d = g.ticket();
        g.close();
        check(!g.accepts(d) && !g.accepts(g.ticket()));
        g.invalidate();
        check(!g.accepts(g.ticket()));
        System.out.println("[OK] VoiceGeneration: stop, interrupt, repeated callback, destroy");
    }
}
