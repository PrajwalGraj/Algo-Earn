import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Menu, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@txnlab/use-wallet-react";
import { ellipseAddress } from "@/utils/ellipseAddress";
import algosdk from "algosdk";
import { getAlgodConfigFromViteEnvironment } from "@/utils/network/getAlgoClientConfigs";


interface NavbarProps {
  onCreateBounty: () => void;
  onConnectWallet: () => void;
}

const Navbar = ({
  onCreateBounty,
  onConnectWallet,
}: NavbarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const { activeAddress } = useWallet();

  const walletConnected = !!activeAddress;

  // Fetch ALGO balance
  useEffect(() => {
    if (!activeAddress) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        setLoadingBalance(true);
        
        // Use fetch API directly to get account info
        const server = "https://testnet-api.algonode.cloud";
        const response = await fetch(`${server}/v2/accounts/${activeAddress}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const algoBalance = data.amount / 1_000_000; // Convert microAlgos to ALGO
        setBalance(algoBalance);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setBalance(0);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [activeAddress]);

  const handleLogout = async () => {
    // Disconnect wallet too if connected
    await logout();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-navbar">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group">
          <img src="/images/logo.png" alt="BountyHub" className="h-9 w-9 object-contain transition-transform duration-300 group-hover:scale-110" />
          <span className="font-display text-xl font-bold text-foreground">
            Bounty<span className="animated-gradient-text">Hub</span>
          </span>
        </a>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 md:flex">
          {walletConnected ? (
            <>
              <Button variant="outline" size="sm" onClick={onCreateBounty}>
                <Plus className="mr-1 h-4 w-4" />
                Create Bounty
              </Button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onConnectWallet}
                  className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  {ellipseAddress(activeAddress)}
                </button>
                <span className="text-xs text-primary/70 font-medium whitespace-nowrap">
                  {loadingBalance ? "Loading..." : balance !== null ? `${balance.toFixed(2)} ALGO` : "0.00 ALGO"}
                </span>
              </div>
            </>
          ) : (
            <Button size="sm" onClick={onConnectWallet} className="gradient-primary text-primary-foreground font-semibold glow-primary">
              <Wallet className="mr-1 h-4 w-4" />
              Connect Wallet
            </Button>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/10 glass md:hidden"
          >
            <div className="flex flex-col gap-2 p-4">
              {walletConnected ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => { onCreateBounty(); setMobileOpen(false); }}>
                    <Plus className="mr-1 h-4 w-4" /> Create Bounty
                  </Button>
                  <button
                    onClick={() => { onConnectWallet(); setMobileOpen(false); }}
                    className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary text-center font-medium w-full flex items-center justify-between"
                  >
                    <span>{ellipseAddress(activeAddress)}</span>
                    <span className="text-xs text-primary/70 font-medium whitespace-nowrap ml-2">
                      {loadingBalance ? "Loading..." : balance !== null ? `${balance.toFixed(2)} ALGO` : "0.00 ALGO"}
                    </span>
                  </button>
                </>
              ) : (
                <Button size="sm" onClick={() => { onConnectWallet(); setMobileOpen(false); }} className="gradient-primary text-primary-foreground font-semibold">
                  <Wallet className="mr-1 h-4 w-4" /> Connect Wallet
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
