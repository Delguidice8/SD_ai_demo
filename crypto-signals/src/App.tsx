import Nav from './components/Nav';
import Hero from './components/Hero';
import Ticker from './components/Ticker';
import Indicators from './components/Indicators';
import HowItWorks from './components/HowItWorks';
import SignalFeed from './components/SignalFeed';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';
import Waitlist from './components/Waitlist';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <Indicators />
        <HowItWorks />
        <SignalFeed />
        <Pricing />
        <FAQ />
        <Waitlist />
      </main>
      <Footer />
    </div>
  );
}
