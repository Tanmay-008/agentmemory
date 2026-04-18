import { ScrollProgress } from "@/components/ScrollProgress";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Stats } from "@/components/Stats";
import { Primitives } from "@/components/Primitives";
import { Features } from "@/components/Features";
import { CommandCenter } from "@/components/CommandCenter";
import { LiveTerminal } from "@/components/LiveTerminal";
import { Compare } from "@/components/Compare";
import { Agents } from "@/components/Agents";
import { Install } from "@/components/Install";
import { Footer } from "@/components/Footer";

export default function Page() {
  return (
    <>
      <ScrollProgress />
      <Nav />
      <main id="top">
        <Hero />
        <Stats />
        <Primitives />
        <Features />
        <CommandCenter />
        <LiveTerminal />
        <Compare />
        <Agents />
        <Install />
      </main>
      <Footer />
    </>
  );
}
