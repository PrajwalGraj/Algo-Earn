import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  createBountyWithWallet,
} from "@/utils/bountyService";
import { saveBounty } from "@/utils/bountyStorage";

interface CreateBountyModalProps {
  open: boolean;
  onClose: () => void;
  onBountyCreated?: () => void;
}

const CreateBountyModal = ({ open, onClose, onBountyCreated }: CreateBountyModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [appId, setAppId] = useState<number | null>(null);

  const { activeAddress, transactionSigner } = useWallet();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeAddress) {
      setError("Please connect your wallet first");
      return;
    }

    if (!transactionSigner) {
      setError("Transaction signer not available. Please reconnect wallet.");
      return;
    }

    if (!reward || isNaN(Number(reward))) {
      setError("Please enter a valid reward amount in ALGO");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      console.log("🚀 Starting bounty creation flow...");
      console.log(`Creator: ${activeAddress}`);
      console.log(`Reward: ${reward} ALGO`);

      // Deploy the real Bounty ARC4 contract, fund it, and call create_bounty
      console.log("\n📍 Deploying & initializing Bounty contract...");
      const appResult = await createBountyWithWallet(
        activeAddress,
        Number(reward),
        transactionSigner
      );

      console.log(
        `✅ Bounty contract deployed & funded: ID ${appResult.appId}, Address: ${appResult.appAddress}`
      );
      setAppId(appResult.appId);

      // Save bounty to localStorage
      console.log('💾 About to save bounty to localStorage...');
      const bountyData = {
        appId: appResult.appId,
        appAddress: appResult.appAddress,
        creator: activeAddress,
        title,
        description,
        reward: Number(reward),
        category,
        difficulty,
        createdAt: Date.now(),
        status: 'active' as const,
      };
      console.log('   Bounty data:', bountyData);
      saveBounty(bountyData);
      console.log('✅ saveBounty() completed');

      setSuccess(true);
      console.log("\n🎉 BOUNTY CREATED SUCCESSFULLY!");
      console.log(`App ID: ${appResult.appId}`);
      console.log(`App Address: ${appResult.appAddress}`);

      setTimeout(() => {
        console.log('📢 Calling onBountyCreated callback...');
        onBountyCreated?.(); // Notify parent to refresh
        console.log('✅ Callback completed');
        onClose();
        setTitle("");
        setDescription("");
        setReward("");
        setCategory("");
        setDifficulty("");
        setSuccess(false);
        setAppId(null);
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Error creating bounty:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-lg rounded-2xl glass-modal p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="font-display text-2xl font-bold text-foreground mb-2">
            Create a Bounty
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Creator:{" "}
            <span className="font-mono text-primary">
              {activeAddress ? activeAddress.slice(0, 15) + "..." : "Not connected"}
            </span>
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex gap-2 items-start">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 flex gap-2 items-start">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-500">
                <p className="font-semibold">🎉 Bounty Created Successfully!</p>
                {appId && (
                  <p className="text-xs mt-1">
                    App ID: <code className="text-green-400">{appId}</code>
                  </p>
                )}
              </div>
            </div>
          )}

          {isSubmitting && (
            <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex gap-2 items-center mb-2">
                <Loader className="h-4 w-4 text-blue-500 animate-spin" />
                <p className="text-sm font-semibold text-blue-500">
                  Creating Your Bounty...
                </p>
              </div>
              <p className="text-xs text-blue-500/80">
                Sign the transactions in your Pera Wallet when prompted.
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Build a token dashboard"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the bounty requirements..."
                rows={4}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Reward (ALGO)
                </label>
                <Input
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  placeholder="e.g. 5"
                  type="number"
                  step="0.01"
                  min="0.1"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Category
                </label>
                <Select
                  value={category}
                  onValueChange={setCategory}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Frontend">Frontend</SelectItem>
                    <SelectItem value="Backend">Backend</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Security">Security</SelectItem>
                    <SelectItem value="Content">Content</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Difficulty
              </label>
              <Select
                value={difficulty}
                onValueChange={setDifficulty}
                disabled={isSubmitting}
              >
                <SelectTrigger className={isSubmitting ? "opacity-50 cursor-not-allowed" : ""}>
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full gradient-primary text-primary-foreground font-semibold glow-primary mt-2"
              disabled={isSubmitting || !activeAddress || success}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader className="h-4 w-4 animate-spin" />
                  Creating...
                </span>
              ) : success ? (
                "✓ Bounty Created"
              ) : (
                "Publish Bounty"
              )}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreateBountyModal;
