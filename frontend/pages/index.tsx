import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Logo from '../components/Logo';
import { isAuthenticated } from '../lib/auth';

interface PhoneMockupProps {
  delay: number;
  image: string;
  title: string;
  className?: string;
}

function PhoneMockup({ delay, image, title, className = '' }: PhoneMockupProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 5]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.8, type: 'spring' }}
      style={{ y, rotate, scale }}
      className={`relative ${className}`}
    >
      <div className="relative w-40 h-80 sm:w-48 sm:h-96 md:w-64 md:h-[32rem] mx-auto">
        {/* Phone Frame */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[3rem] p-3 shadow-2xl">
          <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden relative">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-10" />
            {/* Screen Content */}
            <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
              <div className="text-center p-4">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl mx-auto mb-4 flex items-center justify-center text-4xl">
                  {image}
                </div>
                <p className="text-xs text-gray-600 font-medium">{title}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TypingAnimation({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (currentIndex < text.length) {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }
    }, 50 + delay);

    return () => clearTimeout(timeout);
  }, [currentIndex, text, delay]);

  return (
    <span>
      {displayedText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="inline-block w-0.5 h-5 bg-white ml-1"
      />
    </span>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
  delay: number;
  children?: React.ReactNode;
}

function FeatureCard({ title, description, icon, color, gradient, delay, children }: FeatureCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.6 }}
      className="group"
    >
      <motion.div
        whileHover={{ scale: 1.05, rotateY: 5 }}
        className={`relative overflow-hidden rounded-3xl p-8 ${gradient} shadow-xl cursor-pointer`}
      >
        <div className="relative z-10">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay }}
            className="text-6xl mb-6"
          >
            {icon}
          </motion.div>
          <h3 className={`text-3xl font-bold mb-4 ${color}`}>{title}</h3>
          <p className="text-gray-700 text-lg leading-relaxed mb-6">{description}</p>
          {children}
        </div>
        {/* Animated background elements */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 bg-white/20 rounded-full blur-3xl"
        />
      </motion.div>
    </motion.div>
  );
}

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    const stepDuration = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <span ref={ref} className="text-5xl font-bold">
      {count}{suffix}
    </span>
  );
}

export default function Landing() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Redirect to home if authenticated
    if (isAuthenticated()) {
      router.push('/home');
    }
    setIsLoaded(true);
  }, [router]);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <Layout title="Kartess - Your All-in-One Social Universe">
      <div className="min-h-screen bg-white overflow-hidden">
        {/* Hero Section */}
        <motion.section
          ref={heroRef}
          style={{ opacity }}
          className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20 overflow-hidden"
        >
          {/* Animated Gradient Background */}
          <motion.div
            style={{ y: backgroundY }}
            className="absolute inset-0 bg-gradient-to-br from-gray-100 via-blue-50 via-pink-50 via-yellow-50 to-green-50"
          >
            <motion.div
              animate={{
                backgroundPosition: ['0% 0%', '100% 100%'],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
              className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-pink-400/20 via-green-400/20 to-yellow-400/20 bg-[length:200%_200%]"
            />
          </motion.div>

          {/* Content */}
          <div className="relative z-10 max-w-7xl mx-auto w-full">
            <div className="text-center mb-12">
              {/* Logo with Glow Animation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isLoaded ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.8, type: 'spring' }}
                className="flex justify-center mb-6"
              >
                <motion.div
                  animate={{
                    filter: [
                      'drop-shadow(0 0 20px rgba(59, 130, 246, 0.5))',
                      'drop-shadow(0 0 40px rgba(236, 72, 153, 0.5))',
                      'drop-shadow(0 0 20px rgba(59, 130, 246, 0.5))',
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Logo size="xl" showText={false} onClick={() => {}} />
                </motion.div>
              </motion.div>
              {/* App Name with Glow Animation */}
              <motion.h1
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isLoaded ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.8, type: 'spring', delay: 0.2 }}
                className="text-6xl md:text-8xl font-bold mb-6"
              >
                <motion.span
                  animate={{
                    textShadow: [
                      '0 0 20px rgba(59, 130, 246, 0.5)',
                      '0 0 40px rgba(236, 72, 153, 0.5)',
                      '0 0 20px rgba(59, 130, 246, 0.5)',
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="bg-gradient-to-r from-blue-600 via-pink-600 to-green-600 bg-clip-text text-transparent"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  Kartess
                </motion.span>
              </motion.h1>

              {/* Tagline with Typing Animation */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={isLoaded ? { opacity: 1 } : {}}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="text-xl md:text-2xl text-gray-700 mb-8 min-h-[3rem]"
              >
                <TypingAnimation text="Your All-in-One Social Universe: Connect, Create, Chat, and Career" />
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isLoaded ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1, duration: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                  <motion.button
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(59, 130, 246, 0.4)',
                        '0 0 40px rgba(59, 130, 246, 0.6)',
                        '0 0 20px rgba(59, 130, 246, 0.4)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    onClick={() => router.push('/register')}
                    className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-base sm:text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all min-h-[48px] w-full sm:w-auto"
                  >
                    Get Started
                  </motion.button>
                </motion.div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push('/login')}
                  className="px-6 sm:px-8 py-3 sm:py-4 text-gray-700 text-base sm:text-lg font-semibold rounded-full hover:bg-gray-100 transition-all min-h-[48px] w-full sm:w-auto"
                >
                  Login
                </motion.button>
              </motion.div>
        </div>

            {/* Floating Phone Mockups */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              <PhoneMockup delay={0.2} image="📱" title="Unified Timeline" />
              <PhoneMockup delay={0.4} image="💬" title="Real-time Chats" />
              <PhoneMockup delay={0.6} image="🎨" title="Visual Feeds" />
            </div>
        </div>

          {/* Scroll Indicator */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          >
            <div className="w-6 h-10 border-2 border-gray-400 rounded-full flex justify-center">
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1 h-3 bg-gray-400 rounded-full mt-2"
              />
            </div>
          </motion.div>
        </motion.section>

        {/* Features Showcase */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-5xl font-bold text-center mb-4 text-gray-900"
            >
              Modular & Powerful
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl text-gray-600 text-center mb-16"
            >
              Everything you need in one unified platform
            </motion.p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              {/* Connect Module */}
              <FeatureCard
                title="Connect Module"
                description="Build meaningful relationships with real-time posts, stories, and live updates."
                icon="🔗"
                color="text-blue-700"
                gradient="bg-gradient-to-br from-blue-50 to-blue-100"
                delay={0}
              >
                <div className="flex gap-2 mt-4">
                  {['❤️', '🔗', '💬', '📸'].map((emoji, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        y: [0, -10, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                      className="text-2xl"
                    >
                      {emoji}
                    </motion.div>
                  ))}
                </div>
              </FeatureCard>

              {/* Visuals Module */}
              <FeatureCard
                title="Visuals Module"
                description="Share stunning photos in a beautiful masonry grid. Your creativity, beautifully displayed."
                icon="📸"
                color="text-pink-700"
                gradient="bg-gradient-to-br from-pink-50 to-pink-100"
                delay={0.1}
              >
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="aspect-square bg-gradient-to-br from-pink-200 to-purple-200 rounded-lg"
                    />
                  ))}
                </div>
              </FeatureCard>

              {/* Threads Module */}
              <FeatureCard
                title="Threads Module"
                description="Engage in threaded conversations, polls, and trending discussions. Short posts, big impact."
                icon="💭"
                color="text-green-700"
                gradient="bg-gradient-to-br from-green-50 to-green-100"
                delay={0.2}
              >
                <div className="mt-4 space-y-2">
                  {['Trending: #Kartess', 'Poll: Best Feature?', 'New Thread'].map((text, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ x: 10 }}
                      className="p-3 bg-white/50 rounded-lg text-sm text-gray-700"
                    >
                      {text}
                    </motion.div>
                  ))}
                </div>
              </FeatureCard>

              {/* CareerNet Module */}
              <FeatureCard
                title="CareerNet Module"
                description="Professional networking with endorsements, job opportunities, and career growth tools."
                icon="💼"
                color="text-yellow-700"
                gradient="bg-gradient-to-br from-yellow-50 to-yellow-100"
                delay={0.3}
              >
                <div className="flex gap-2 mt-4">
                  {['⭐', '🎖️', '🏆', '💎'].map((badge, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        scale: [1, 1.2, 1],
                        filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.3,
                      }}
                      className="text-3xl"
                    >
                      {badge}
                    </motion.div>
                  ))}
                </div>
              </FeatureCard>
            </div>

            {/* Unified Timeline Demo */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-8 md:p-12"
            >
              <h3 className="text-3xl font-bold text-center mb-8 text-gray-900">
                Unified Timeline
              </h3>
              <div className="space-y-4 max-w-2xl mx-auto">
                {[
                  { module: 'Connect', icon: '🔗', colorClass: 'border-blue-500' },
                  { module: 'Visuals', icon: '📸', colorClass: 'border-pink-500' },
                  { module: 'Threads', icon: '💭', colorClass: 'border-green-500' },
                  { module: 'CareerNet', icon: '💼', colorClass: 'border-yellow-500' },
                ].map((post, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2 }}
                    className={`bg-white rounded-xl p-4 shadow-md flex items-center gap-4 border-l-4 ${post.colorClass}`}
                  >
                    <span className="text-2xl">{post.icon}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{post.module} Post</p>
                      <p className="text-sm text-gray-500">Live content from all modules</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Real-Time & Interactive Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <div className="max-w-7xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold text-center mb-16"
            >
              Real-Time & Interactive
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              {/* Notification Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="relative inline-block mb-4">
                  <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-3xl">
                    🔔
                  </div>
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.8, 1],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold"
                  >
                    3
                  </motion.div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Live Notifications</h3>
                <p className="text-gray-300">Never miss an update</p>
              </motion.div>

              {/* Chat Bubbles */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="relative mb-4">
                  <div className="flex gap-2 justify-center">
                    {['💬', '💬', '💬'].map((bubble, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          y: [0, -10, 0],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                        className="text-4xl"
                      >
                        {bubble}
                      </motion.div>
                    ))}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Seamless Messaging</h3>
                <p className="text-gray-300">Real-time chat & calls</p>
              </motion.div>

              {/* QR Code */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <motion.div
                  animate={{
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-20 h-20 bg-white rounded-lg mx-auto mb-4 flex items-center justify-center text-3xl"
                >
                  📱
                </motion.div>
                <h3 className="text-xl font-semibold mb-2">Quick Connect</h3>
                <p className="text-gray-300">Scan & connect instantly</p>
              </motion.div>
            </div>

            {/* Video Call Preview */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gray-700 rounded-3xl p-8 md:p-12 text-center"
            >
              <h3 className="text-3xl font-bold mb-8">Video Calls & Live Streaming</h3>
              <div className="flex justify-center gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: [10, 30, 10],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                    className="w-2 bg-blue-400 rounded-full"
                  />
                ))}
              </div>
              <p className="text-gray-300">Crystal clear audio & video quality</p>
            </motion.div>

            {/* Stats Counter */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16"
            >
              {[
                { value: 1000, suffix: '+', label: 'Connections' },
                { value: 500, suffix: '+', label: 'Active Users' },
                { value: 100, suffix: '%', label: 'Privacy' },
                { value: 24, suffix: '/7', label: 'Support' },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-pink-400 bg-clip-text text-transparent">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-gray-300">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div>
                <h4 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-pink-400 bg-clip-text text-transparent">
                  Kartess
                </h4>
                <p className="text-gray-400">
                  Your All-in-One Social Universe
                </p>
              </div>
              <div>
                <h5 className="font-semibold mb-4">Features</h5>
                <ul className="space-y-2 text-gray-400">
                  <li><a href="#" className="hover:text-white transition">Connect</a></li>
                  <li><a href="#" className="hover:text-white transition">Visuals</a></li>
                  <li><a href="#" className="hover:text-white transition">Threads</a></li>
                  <li><a href="#" className="hover:text-white transition">CareerNet</a></li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold mb-4">Legal</h5>
                <ul className="space-y-2 text-gray-400">
                  <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                  <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
                  <li><a href="#" className="hover:text-white transition">Cookie Policy</a></li>
                </ul>
              </div>
              <div>
                <h5 className="font-semibold mb-4">Connect</h5>
                <div className="flex gap-4 mb-4">
                  {['Twitter', 'LinkedIn', 'Instagram', 'Facebook'].map((social, i) => (
                    <motion.a
                      key={i}
                      whileHover={{ rotate: 360, scale: 1.2 }}
                      href="#"
                      className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition"
                    >
                      <span className="text-sm">{social[0]}</span>
                    </motion.a>
                  ))}
                </div>
              </div>
            </div>

            {/* Newsletter Signup */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="border-t border-gray-800 pt-8"
            >
              <div className="flex justify-center mb-6">
                <Logo size="md" showText={false} onClick={() => {}} />
              </div>
              <div className="max-w-md mx-auto">
                <h5 className="font-semibold mb-4 text-center">Stay Updated</h5>
                <div className="flex gap-2">
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 px-4 py-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-semibold hover:shadow-lg transition"
                  >
                    Subscribe
                  </motion.button>
                </div>
              </div>
            </motion.div>

            <div className="text-center text-gray-400 mt-8 text-sm">
              <p>&copy; 2024 Kartess. All rights reserved.</p>
            </div>
        </div>
        </footer>
      </div>
    </Layout>
  );
}
