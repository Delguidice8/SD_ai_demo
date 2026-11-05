import React, { useEffect } from 'react';
import { 
  MessageSquareCode, 
  CalendarClock, 
  Users, 
  Clock, 
  TrendingUp,
  Scale,
  Mail,
  Phone,
  MapPin,
  BrainCircuit as Circuit,
  Bot,
  Database,
  Calendar
} from 'lucide-react';

function App() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const glowElements = document.querySelectorAll('.mouse-glow');
      glowElements.forEach((element) => {
        const rect = (element as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        (element as HTMLElement).style.setProperty('--mouse-x', `${x}px`);
        (element as HTMLElement).style.setProperty('--mouse-y', `${y}px`);
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/10 to-gray-900 text-white font-sans">
      {/* Logo */}
      <div className="fixed top-6 left-6 z-50 flex items-center space-x-2">
        <div className="relative">
          <Circuit className="w-8 h-8 text-blue-400 logo-circle" />
          <div className="absolute inset-0 bg-blue-400 rounded-full blur-lg opacity-40"></div>
        </div>
        <span className="text-xl font-bold logo-text">SD.ai</span>
      </div>

      {/* Jarvis launcher */}
      <a
        href="#jarvis"
        className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-400/50 bg-gray-900/70 backdrop-blur text-cyan-300 text-sm font-semibold hover:bg-cyan-400/10 hover:glow transition-all"
      >
        <Bot className="w-4 h-4" />
        Launch Jarvis
      </a>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center mouse-glow">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 grid-background"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-gray-900"></div>
        </div>
        <div className="container mx-auto px-6 z-10">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600 animate-gradient">
              Revolutionize Your Business with AI-Powered Automation
            </h1>
            <p className="text-xl md:text-2xl text-blue-100/80 mb-8 font-light">
              Enhance customer support, streamline CRM processes, and automate appointment scheduling with SD.ai.
            </p>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 hover:glow">
              Get Started with a Free Consultation
            </button>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 tech-gradient mouse-glow">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">Our AI Solutions</h2>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                icon: <Bot className="w-12 h-12 mb-6 text-blue-400" />,
                title: "AI-Driven Customer Support",
                description: "Implement intelligent virtual assistants to provide 24/7 customer engagement"
              },
              {
                icon: <Database className="w-12 h-12 mb-6 text-blue-400" />,
                title: "Seamless CRM Integrations",
                description: "Enhance your existing CRM systems with AI for improved data management"
              },
              {
                icon: <Calendar className="w-12 h-12 mb-6 text-blue-400" />,
                title: "Automated Scheduling",
                description: "Utilize AI to manage and optimize your appointment bookings"
              }
            ].map((service, index) => (
              <div key={index} className="glass-card p-8 rounded-xl hover:transform hover:scale-105 transition-all">
                {service.icon}
                <h3 className="text-2xl font-semibold mb-4">{service.title}</h3>
                <p className="text-blue-100/70">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-900 mouse-glow">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">Why Choose SD.ai?</h2>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                icon: <Clock className="w-12 h-12 mb-6 text-yellow-400" />,
                title: "24/7 Customer Engagement",
                description: "AI sales representatives provide instant responses, ensuring no lead is missed"
              },
              {
                icon: <TrendingUp className="w-12 h-12 mb-6 text-green-400" />,
                title: "Enhanced Efficiency",
                description: "Automating routine tasks allows your team to focus on strategic activities"
              },
              {
                icon: <Scale className="w-12 h-12 mb-6 text-purple-400" />,
                title: "Scalable Solutions",
                description: "Our AI tools grow with your business, adapting to increasing demands"
              }
            ].map((benefit, index) => (
              <div key={index} className="text-center glass-card p-8 rounded-xl">
                <div className="flex justify-center">{benefit.icon}</div>
                <h3 className="text-2xl font-semibold mb-4">{benefit.title}</h3>
                <p className="text-blue-100/70">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section className="py-20 tech-gradient mouse-glow">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">Success Stories</h2>
          <div className="max-w-4xl mx-auto glass-card p-8 rounded-xl">
            <div className="flex flex-col items-center text-center">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80"
                alt="John Smith"
                className="w-20 h-20 rounded-full mb-6 object-cover ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900"
              />
              <p className="text-xl mb-6 text-blue-100/90 font-light italic">
                "Implementing SD.ai's automation tools transformed our customer service, leading to a 50% increase in satisfaction ratings."
              </p>
              <h4 className="font-semibold">John Smith</h4>
              <p className="text-blue-100/70">COO of Tech Solutions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies Section */}
      <section className="py-20 bg-gray-900 mouse-glow">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">Our Impact</h2>
          <div className="max-w-4xl mx-auto glass-card p-8 rounded-xl">
            <h3 className="text-2xl font-semibold mb-6">XYZ Enterprises</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xl font-semibold mb-4 text-blue-400">Challenge</h4>
                <p className="text-blue-100/70 mb-6">High volume of missed customer inquiries</p>
                <h4 className="text-xl font-semibold mb-4 text-blue-400">Solution</h4>
                <p className="text-blue-100/70">Deployed AI-driven customer support agents</p>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-4 text-blue-400">Results</h4>
                <ul className="text-blue-100/70 space-y-2">
                  <li className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                    <span>60% reduction in response times</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                    <span>40% increase in lead conversions</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                    <span>24/7 customer support coverage</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800 mouse-glow">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-8">Ready to Transform Your Business with AI?</h2>
          <button className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-all transform hover:scale-105 hover:glow">
            Schedule Your Free Consultation Now
          </button>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 tech-gradient mouse-glow">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">Get in Touch</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 glass-card p-8 rounded-xl">
              <div className="flex items-center space-x-4">
                <Mail className="w-6 h-6 text-blue-400" />
                <p className="text-blue-100/90">contact@sd.ai</p>
              </div>
              <div className="flex items-center space-x-4">
                <Phone className="w-6 h-6 text-blue-400" />
                <p className="text-blue-100/90">(123) 456-7890</p>
              </div>
              <div className="flex items-center space-x-4">
                <MapPin className="w-6 h-6 text-blue-400" />
                <p className="text-blue-100/90">123 Innovation Drive, Tech City</p>
              </div>
            </div>
            <form className="glass-card p-8 rounded-xl space-y-6">
              <input
                type="text"
                placeholder="Your Name"
                className="w-full p-3 rounded-lg bg-gray-900/50 border border-blue-900/30 focus:border-blue-400 focus:outline-none transition-colors"
              />
              <input
                type="email"
                placeholder="Your Email"
                className="w-full p-3 rounded-lg bg-gray-900/50 border border-blue-900/30 focus:border-blue-400 focus:outline-none transition-colors"
              />
              <textarea
                placeholder="Your Message"
                rows={4}
                className="w-full p-3 rounded-lg bg-gray-900/50 border border-blue-900/30 focus:border-blue-400 focus:outline-none transition-colors"
              ></textarea>
              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-all hover:glow">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;