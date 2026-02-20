import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Bounty } from "@/data/bounties";
import Navbar from "@/components/bounty/Navbar";
import HeroSection from "@/components/bounty/HeroSection";
import ScrollingBounties from "@/components/bounty/ScrollingBounties";
import BountyList from "@/components/bounty/BountyList";
import BountyDetailModal from "@/components/bounty/BountyDetailModal";
import CreateBountyModal from "@/components/bounty/CreateBountyModal";
import WalletModal from "@/components/bounty/WalletModal";
import { Github, Twitter, MessageCircle } from "lucide-react";
import { getBounties, StoredBounty } from "@/utils/bountyStorage";

/** Map a localStorage StoredBounty to the UI Bounty interface */
function storedToUiBounty(sb: StoredBounty): Bounty {
  const statusMap: Record<string, Bounty["status"]> = {
    active: "Open",
    claimed: "In Progress",
    completed: "Completed",
  };
  return {
    id: `chain-${sb.appId}`,
    title: sb.title,
    description: sb.description,
    reward: `${sb.reward} ALGO`,
    category: sb.category,
    difficulty: (sb.difficulty as Bounty["difficulty"]) || "Medium",
    deadline: new Date(sb.createdAt + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    creator: sb.creator.slice(0, 6) + "..." + sb.creator.slice(-4),
    status: statusMap[sb.status] ?? "Open",
    appId: sb.appId,
    creatorAddress: sb.creator,
  };
}

/* ── Wave SVG divider component ── */
const WaveDivider = ({ flip = false, color = "rgba(124,58,237,0.06)" }: { flip?: boolean; color?: string }) => (
  <div className={`wave-divider pointer-events-none ${flip ? "rotate-180" : ""}`}>
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0,40 C240,100 480,0 720,60 C960,120 1200,20 1440,80 L1440,120 L0,120 Z"
        fill={color}
      />
      <path
        d="M0,60 C360,10 720,110 1080,40 C1260,10 1380,50 1440,30 L1440,120 L0,120 Z"
        fill={color}
        opacity="0.5"
      />
    </svg>
  </div>
);

const Index = () => {
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -500, y: -500 });
  const [createdBounties, setCreatedBounties] = useState<Bounty[]>([]);
  const bountiesRef = useRef<HTMLDivElement>(null);

  /** Load user-created bounties from localStorage */
  const loadCreatedBounties = useCallback(() => {
    const stored = getBounties();
    setCreatedBounties(stored.map(storedToUiBounty));
  }, []);

  useEffect(() => {
    loadCreatedBounties();
  }, [loadCreatedBounties]);

  const scrollToBounties = () => {
    bountiesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /* ── Cursor glow follow ── */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* ── Cursor glow ── */}
      <div
        className="cursor-glow hidden md:block"
        style={{ left: cursorPos.x, top: cursorPos.y }}
      />

      {/* ── Animated gradient blobs — like the reference glassmorphism image ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {/* Blob 1 — Large pink/magenta, top-left corner */}
        <div
          style={{
            position: 'absolute',
            width: '650px',
            height: '650px',
            top: '-8%',
            left: '-8%',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 60% 40%, #f9a8d4 0%, #f472b6 40%, #ec4899 70%, transparent 100%)',
            filter: 'blur(40px)',
            opacity: 0.75,
            animation: 'blob-float-1 20s ease-in-out infinite',
          }}
        />
        {/* Blob 2 — Purple/violet, top-right */}
        <div
          style={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            top: '-5%',
            right: '-3%',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 50%, #c4b5fd 0%, #a78bfa 40%, #8b5cf6 70%, transparent 100%)',
            filter: 'blur(35px)',
            opacity: 0.65,
            animation: 'blob-float-2 24s ease-in-out infinite',
          }}
        />
        {/* Blob 3 — Blue/cyan, right side */}
        <div
          style={{
            position: 'absolute',
            width: '550px',
            height: '550px',
            top: '30%',
            right: '-6%',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 50%, #93c5fd 0%, #60a5fa 40%, #3b82f6 70%, transparent 100%)',
            filter: 'blur(35px)',
            opacity: 0.6,
            animation: 'blob-float-3 22s ease-in-out infinite',
          }}
        />
        {/* Blob 4 — Cyan/teal, bottom-right */}
        <div
          style={{
            position: 'absolute',
            width: '450px',
            height: '450px',
            bottom: '-5%',
            right: '10%',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 40%, #67e8f9 0%, #22d3ee 50%, #06b6d4 80%, transparent 100%)',
            filter: 'blur(40px)',
            opacity: 0.55,
            animation: 'blob-float-4 18s ease-in-out infinite',
          }}
        />
        {/* Blob 5 — Pink/rose, bottom-left */}
        <div
          style={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            bottom: '-8%',
            left: '-5%',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 60% 50%, #fda4af 0%, #fb7185 50%, #f43f5e 80%, transparent 100%)',
            filter: 'blur(40px)',
            opacity: 0.55,
            animation: 'blob-float-2 26s ease-in-out infinite',
            animationDelay: '-8s',
          }}
        />
        {/* Blob 6 — Soft lavender, center-left accent */}
        <div
          style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            top: '50%',
            left: '-4%',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 50%, #ddd6fe 0%, #c4b5fd 50%, #a78bfa 80%, transparent 100%)',
            filter: 'blur(45px)',
            opacity: 0.5,
            animation: 'blob-float-1 28s ease-in-out infinite',
            animationDelay: '-12s',
          }}
        />
      </div>

      {/* ── All content above blobs ── */}
      <motion.div
        className="relative"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <Navbar
          onCreateBounty={() => setCreateOpen(true)}
          onConnectWallet={() => setWalletModalOpen(true)}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <HeroSection onExplore={scrollToBounties} />
        </motion.div>

        <WaveDivider color="rgba(124,58,237,0.05)" />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <ScrollingBounties onBountyClick={setSelectedBounty} />
        </motion.div>

        <WaveDivider flip color="rgba(59,130,246,0.05)" />

        <div ref={bountiesRef}>
          <BountyList onBountyClick={setSelectedBounty} extraBounties={createdBounties} />
        </div>

        <BountyDetailModal bounty={selectedBounty} onClose={() => setSelectedBounty(null)} />
        <CreateBountyModal open={createOpen} onClose={() => setCreateOpen(false)} onBountyCreated={loadCreatedBounties} />
        <WalletModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />

        <WaveDivider color="rgba(139,92,246,0.04)" />

        {/* ── Footer ── */}
        <footer className="py-14 mt-8 bg-white/40 backdrop-blur-sm border-t border-slate-200/50">
          <div className="container mx-auto px-4">
            <div className="grid gap-10 md:grid-cols-4">
              {/* Brand */}
              <div className="md:col-span-1">
                <a href="/" className="flex items-center gap-2 mb-4">
                  <img src="/images/logo.png" alt="BountyHub" className="h-9 w-9 object-contain" />
                  <span className="font-display text-xl font-bold text-slate-700">
                    Bounty<span className="text-gradient-primary">Hub</span>
                  </span>
                </a>
                <p className="text-sm text-slate-500 leading-relaxed">
                  The premier platform for Web3 bounties. Build, earn, and grow in the decentralized ecosystem.
                </p>
              </div>

              {/* Platform */}
              <div>
                <h4 className="font-display font-semibold text-slate-700 mb-4">Platform</h4>
                <ul className="space-y-2.5">
                  {["Explore Bounties", "Create Bounty", "Leaderboard", "How It Works"].map((item) => (
                    <li key={item}>
                      <a href="#" className="text-sm text-slate-500 hover:text-violet-500 transition-colors duration-200">
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h4 className="font-display font-semibold text-slate-700 mb-4">Resources</h4>
                <ul className="space-y-2.5">
                  {["Documentation", "API Reference", "Blog", "Support"].map((item) => (
                    <li key={item}>
                      <a href="#" className="text-sm text-slate-500 hover:text-violet-500 transition-colors duration-200">
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Community */}
              <div>
                <h4 className="font-display font-semibold text-slate-700 mb-4">Community</h4>
                <div className="flex gap-2.5 mb-4">
                  {[
                    { icon: Github, label: "GitHub" },
                    { icon: Twitter, label: "Twitter" },
                    { icon: MessageCircle, label: "Discord" },
                  ].map(({ icon: Icon, label }) => (
                    <a
                      key={label}
                      href="#"
                      aria-label={label}
                      className="h-9 w-9 rounded-full bg-white/60 border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-violet-500 hover:bg-white hover:scale-105 transition-all duration-200"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  Join 5,000+ builders in our community
                </p>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="mt-10 pt-6 border-t border-slate-300/50 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                &copy; 2026 BountyHub. Built for the decentralized future.
              </p>
              <div className="flex gap-6">
                {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                  <a key={item} href="#" className="text-xs text-slate-500 hover:text-violet-500 transition-colors">
                    {item}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </motion.div>
    </div>
  );
};

export default Index;
