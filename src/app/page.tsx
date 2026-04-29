'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LandingNavbar from '@/components/LandingNavbar';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-[32rem] h-[32rem] bg-purple-300 opacity-30 blob float" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-blue-300 opacity-25 blob float-delayed" />
      </div>

      <LandingNavbar />

      {/* HERO — full-width image with centered headline */}
      <section className="relative">
        <div className="relative w-full h-[88vh] min-h-[640px] overflow-hidden">
          <img src="/hero.jpg" alt="Study abroad" className="absolute inset-0 w-full h-full object-cover" />
          {/* Soft gradient overlay top → bottom for legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/20 to-slate-900/60" />

          {/* Centered headline */}
          <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4 slide-up">
            <p className="text-xs md:text-sm font-bold tracking-[0.3em] text-white/80 uppercase mb-6">SmartStudy · For Bangladeshi students</p>
            <h1 className="text-6xl md:text-8xl lg:text-[9rem] font-black uppercase leading-[0.95] tracking-tight max-w-6xl drop-shadow-2xl">
              Find your perfect <span className="italic font-light">match</span>
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mt-8 leading-relaxed">
              AI-matched MS programs abroad. By your CGPA, IELTS, budget, and research.
            </p>
            <div className="flex flex-wrap gap-3 mt-10 justify-center">
              <Link href="/signup"
                className="px-8 py-4 rounded-full bg-white text-slate-900 font-bold shadow-2xl hover:scale-[1.03] transition">
                Get started →
              </Link>
              <a href="#how"
                className="px-8 py-4 rounded-full bg-white/15 backdrop-blur border border-white/30 text-white font-semibold hover:bg-white/25 transition">
                See how it works
              </a>
            </div>
          </div>

          {/* Floating left blob — stat */}
          <div className="hidden md:flex absolute bottom-24 left-10 lg:left-20 flex-col items-center justify-center w-32 h-32 rounded-full bg-white/95 backdrop-blur shadow-2xl scale-in">
            <p className="text-3xl font-black gradient-text leading-none">50+</p>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mt-1">Countries</p>
          </div>

          {/* Floating right card */}
          <div className="hidden md:flex absolute bottom-24 right-10 lg:right-20 bg-white rounded-2xl shadow-2xl p-3 items-center gap-3 scale-in max-w-xs">
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
              <img src="/hero.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top match</p>
              <p className="text-sm font-bold text-slate-900 leading-tight">Carnegie Mellon — Robotics</p>
              <p className="text-xs text-emerald-600 font-bold">87% fit</p>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium tracking-widest uppercase animate-bounce">
            ↓ Scroll
          </div>
        </div>

        {/* Stat cards row */}
        <div className="max-w-7xl mx-auto px-4 pt-16 pb-16 -mt-12 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { v: '450+',  l: 'Universities', icon: '🏛️', tint: 'from-purple-500 to-pink-500' },
              { v: '50+',   l: 'Countries',    icon: '🌍', tint: 'from-blue-500 to-cyan-500' },
              { v: '98%',   l: 'Match accuracy', icon: '🎯', tint: 'from-emerald-500 to-teal-500' },
              { v: '24/7',  l: 'AI assistant', icon: '🤖', tint: 'from-amber-500 to-orange-500' },
            ].map((s, i) => (
              <div key={i} className="p-5 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-lg transition">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.tint} text-2xl flex items-center justify-center shadow-md`}>
                  <span>{s.icon}</span>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900">{s.v}</div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{s.l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-bold text-purple-600 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Everything you need, in one place.</h2>
            <p className="text-lg text-slate-600">From discovery to decision day — we handle the messy middle so you focus on writing your SOP.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🎯', title: 'Smart matching',           desc: 'RAG + cross-encoder finds programs that fit your CGPA, budget, English score, and research interest.', tint: 'from-purple-500 to-pink-500' },
              { icon: '🔬', title: 'Research-aware scoring',   desc: 'Have publications or a thesis? Top labs see them — your match score boosts for research-heavy unis.',  tint: 'from-pink-500 to-rose-500' },
              { icon: '🤖', title: 'Profile-aware AI chat',    desc: 'Local Mistral LLM that knows your numbers. Asks the right follow-ups, never generic advice.',          tint: 'from-blue-500 to-cyan-500' },
              { icon: '⚖️', title: 'Side-by-side compare',     desc: 'Stack any 2 saved unis on tuition, deadlines, requirements — green cell = winner. No spreadsheets.',  tint: 'from-emerald-500 to-teal-500' },
              { icon: '📋', title: 'Kanban application tracker', desc: '5 stages from Saved → Decision. Drag-and-drop. Overdue badges. No more lost portal logins.',         tint: 'from-amber-500 to-orange-500' },
              { icon: '✅', title: 'Requirement gap analyzer', desc: 'Per-uni checklist: are you above their min CGPA? Below their IELTS? See exactly what to fix.',          tint: 'from-indigo-500 to-purple-500' },
            ].map((f, i) => (
              <div key={i} className="group p-6 rounded-2xl border border-slate-100 hover:border-transparent hover:shadow-2xl transition-all bg-white">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${f.tint} text-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition mb-4`}>{f.icon}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-bold text-pink-600 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Three steps. About an hour.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '01', icon: '👤', title: 'Build your profile', desc: 'CGPA, IELTS/TOEFL, budget, country, publications. Auto-fills every search.' },
              { n: '02', icon: '🔍', title: 'Find your matches',   desc: 'AI searches 450+ unis and ranks them by fit. See match score, reasons, and gaps.' },
              { n: '03', icon: '🚀', title: 'Track to submission', desc: 'Save shortlist, manage deadlines, run side-by-side compares, get AI feedback.' },
            ].map((s, i) => (
              <div key={i} className="relative">
                <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-lg border border-slate-100 h-full">
                  <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-500 to-pink-500 mb-2">{s.n}</div>
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-purple-300 to-pink-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SUCCESS STORIES */}
      <section id="stories" className="py-24 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-3">Success stories</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Students who got in.</h2>
            <p className="text-lg text-slate-600">Real outcomes. Names changed for privacy.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Sadia R.',     from: 'BUET → Carnegie Mellon',
                quote: 'I wasted 3 months making spreadsheets. SmartStudy ranked my fits in 30 seconds and I caught a CMU funding deadline I would have missed.',
                tag: 'MS Robotics · 2025',
                color: 'from-purple-500 to-pink-500',
              },
              {
                name: 'Tanvir A.',    from: 'NSU → Technical University of Munich',
                quote: 'The gap analyzer told me my IELTS 6.5 was below TUM\'s min. Retook it, got 7.5, got admitted with €0 tuition. Saved my year.',
                tag: 'MS Informatics · 2025',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                name: 'Arif H.',      from: 'IUT → University of Toronto',
                quote: 'I have one published paper. The research-boost feature put U of T at the top of my list. Got admitted with a $15K research assistantship.',
                tag: 'MASc ECE · 2025',
                color: 'from-emerald-500 to-teal-500',
              },
            ].map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-xl transition">
                <div className="flex gap-1 mb-4">{[...Array(5)].map((_, k) => <span key={k} className="text-amber-400">★</span>)}</div>
                <p className="text-slate-700 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${t.color} text-white font-bold flex items-center justify-center shadow-lg`}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.from}</p>
                    <p className="text-xs text-purple-600 font-medium mt-0.5">{t.tag}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 text-center">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">Students placed at</p>
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 text-slate-400 font-bold text-lg">
              <span>MIT</span><span>·</span>
              <span>Stanford</span><span>·</span>
              <span>CMU</span><span>·</span>
              <span>U of Toronto</span><span>·</span>
              <span>TU Munich</span><span>·</span>
              <span>ETH Zürich</span><span>·</span>
              <span>NUS</span>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-purple-400/30 to-pink-400/30 blur-3xl rounded-3xl" />
            <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80"
                alt="Students collaborating"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-purple-600 uppercase tracking-widest mb-3">About us</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">Built by students, for students.</h2>
            <p className="text-lg text-slate-700 leading-relaxed mb-4">
              SmartStudy is a senior capstone project at <strong>North South University</strong>, born from a frustration shared by thousands of Bangladeshi undergrads — the apply-abroad process is opaque, expensive, and lonely.
            </p>
            <p className="text-lg text-slate-700 leading-relaxed mb-6">
              We combine retrieval-augmented search, a local Mistral LLM, and a curated dataset of 450+ universities to give every student the data and guidance that used to require a private consultant.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-2xl font-bold gradient-text">450+</p>
                <p className="text-xs text-slate-600 font-medium">Universities indexed</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-2xl font-bold gradient-text">🇧🇩 First</p>
                <p className="text-xs text-slate-600 font-medium">Bangladesh-tuned matching</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-4 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900">Quick answers.</h2>
          </div>

          <div className="space-y-3">
            {[
              { q: 'How accurate is the AI matching?',
                a: 'We use RAG (semantic search) plus BM25 keyword search, then re-rank with a cross-encoder. Match scores reflect a weighted average of budget fit, GPA, English requirements, field, scholarships, and research alignment.' },
              { q: 'Do I need to install anything?',
                a: 'No. SmartStudy is a web app. The AI runs locally on our backend (Ollama + Mistral 7B), so it\'s fast and your profile data never leaves our servers.' },
              { q: 'What about my data?',
                a: 'Your profile is stored in Firebase under your account only. We never sell or share data. You can delete your account any time.' },
              { q: 'What countries do you cover?',
                a: 'USA, UK, Canada, Australia, Germany are our deepest datasets. We also have programs from 50+ other countries — coverage grows weekly.' },
              { q: 'Can it help me write my SOP?',
                a: 'The chatbot can give feedback on drafts using your profile and target unis as context. A dedicated SOP generator is on our roadmap.' },
              { q: 'Who is behind SmartStudy?',
                a: 'A team of senior CSE students at North South University, supervised by faculty. This started as a capstone project and is being actively maintained.' },
            ].map((item, i) => (
              <details key={i} className="group rounded-xl bg-white hover:bg-white transition border border-slate-100">
                <summary className="cursor-pointer p-5 flex items-center justify-between font-semibold text-slate-900">
                  <span>{item.q}</span>
                  <span className="text-purple-500 text-xl group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="px-5 pb-5 text-slate-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto rounded-3xl overflow-hidden relative shadow-2xl">
          <img src="/hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/60 to-slate-900/30" />
          <div className="relative px-8 py-24 md:px-20 md:py-32 text-white max-w-3xl">
            <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest mb-4">Your future · Decided today</p>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-black uppercase leading-[1.02] mb-6 tracking-tight">
              Ready to find your<br />perfect <span className="italic font-light">match?</span>
            </h2>
            <p className="text-lg md:text-xl text-white/85 mb-10 max-w-xl leading-relaxed">
              Setup takes 60 seconds. Get matched to 450+ universities by AI — built specifically for Bangladeshi students applying abroad.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup"
                className="px-8 py-4 rounded-full bg-white text-slate-900 font-bold text-base shadow-2xl hover:scale-105 transition">
                Get started →
              </Link>
              <Link href="/login"
                className="px-8 py-4 rounded-full bg-white/15 backdrop-blur border border-white/30 text-white font-semibold hover:bg-white/25 transition">
                I have an account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-xl">🎓</div>
                <span className="text-xl font-bold text-white">SmartStudy</span>
              </div>
              <p className="text-sm text-slate-400 max-w-md">AI-powered study abroad assistant — built for Bangladeshi students who want to study at the world's best universities.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-3">Product</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#how" className="hover:text-white">How it works</a></li>
                <li><a href="#faq" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-3">Account</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="/signup" className="hover:text-white">Sign up</Link></li>
                <li><Link href="/login" className="hover:text-white">Log in</Link></li>
                <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">© 2026 SmartStudy · A capstone project at North South University</p>
            <p className="text-xs text-slate-500">Made with 💜 in Dhaka</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
