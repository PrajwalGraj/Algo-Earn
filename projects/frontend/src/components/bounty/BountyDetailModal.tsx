import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Clock,
  MessageSquare,
  Trophy,
  Users,
  MapPin,
  Bookmark,
  ChevronRight,
  CheckCircle2,
  Send,
  User,
} from "lucide-react";
import { Bounty } from "@/data/bounties";
import { Button } from "@/components/ui/button";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  BountySubmission,
  getSubmissionsForBounty,
  addSubmission,
  approveSubmission,
} from "@/utils/submissionStorage";
import {
  callClaimMethod,
  callSubmitWorkMethod,
  callApproveMethod,
  getBountyOnChainInfo,
} from "@/utils/bountyService";

interface BountyDetailModalProps {
  bounty: Bounty | null;
  onClose: () => void;
}

const difficultyConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Easy: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  Medium: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  Hard: { bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-400" },
};

const placeColors: Record<string, string> = {
  "1st": "text-yellow-400",
  "2nd": "text-slate-300",
  "3rd": "text-amber-600",
};

function useCountdown(deadline: string) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const target = new Date(deadline).getTime();
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining("Ended"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  return remaining;
}

/** Renders markdown-lite text: **bold**, \n\n as paragraphs, - bullets */
function RichText({ text }: { text: string }) {
  const paragraphs = text.split("\n\n");
  return (
    <>
      {paragraphs.map((p, i) => {
        // Heading
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <h3 key={i} className="text-lg font-bold text-foreground mt-6 mb-2">
              {p.replace(/\*\*/g, "")}
            </h3>
          );
        }
        // Bullet list
        if (p.includes("\n- ") || p.startsWith("- ")) {
          const lines = p.split("\n").filter(Boolean);
          const heading = !lines[0].startsWith("- ") ? lines.shift() : null;
          return (
            <div key={i}>
              {heading && (
                <h3 className="text-lg font-bold text-foreground mt-6 mb-2">
                  {heading.replace(/\*\*/g, "")}
                </h3>
              )}
              <ul className="space-y-2 my-2">
                {lines.map((l, j) => (
                  <li key={j} className="flex items-start gap-2 text-[15px] text-muted-foreground">
                    <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{l.replace(/^- /, "").replace(/\*\*(.*?)\*\*/g, "$1")}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        // Bold headings inline
        if (p.startsWith("**")) {
          const title = p.match(/^\*\*(.*?)\*\*/)?.[1];
          const rest = p.replace(/^\*\*.*?\*\*\s*/, "");
          return (
            <div key={i}>
              {title && <h3 className="text-lg font-bold text-foreground mt-6 mb-2">{title}</h3>}
              {rest && <p className="text-[15px] text-muted-foreground leading-relaxed">{rest}</p>}
            </div>
          );
        }
        // Normal paragraph
        return (
          <p key={i} className="text-[15px] text-muted-foreground leading-relaxed my-2">
            {p}
          </p>
        );
      })}
    </>
  );
}

const BountyDetailModal = ({ bounty, onClose }: BountyDetailModalProps) => {
  if (!bounty) return null;

  const { activeAddress, transactionSigner } = useWallet();
  const diff = difficultyConfig[bounty.difficulty];
  const remaining = useCountdown(bounty.deadline);
  const prizes = bounty.prizes || [];
  const skills = bounty.skills || [];
  const submissions = bounty.submissions ?? 0;
  const comments = bounty.comments ?? 0;

  // Determine if the connected wallet is the bounty creator
  const isOwner =
    !!activeAddress &&
    !!bounty.creatorAddress &&
    activeAddress.toLowerCase() === bounty.creatorAddress.toLowerCase();

  // Submission responses state
  const [responses, setResponses] = useState<BountySubmission[]>([]);
  const [submitText, setSubmitText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [approveResult, setApproveResult] = useState<{ success: boolean; appId?: number; txId?: string; error?: string } | null>(null);
  const [approving, setApproving] = useState(false);

  // On-chain state: track whether user has claimed this bounty
  const [onChainStatus, setOnChainStatus] = useState<number | null>(null); // null=loading
  const [onChainWorker, setOnChainWorker] = useState<string | null>(null);
  const [stateLoading, setStateLoading] = useState(false);

  // Derived: is the connected wallet the on-chain worker who claimed?
  const isClaimedByMe =
    !!activeAddress &&
    !!onChainWorker &&
    activeAddress.toLowerCase() === onChainWorker.toLowerCase() &&
    (onChainStatus === 1 || claimSuccess);

  // Fetch on-chain bounty state
  const fetchOnChainState = async () => {
    if (!bounty?.appId) return;
    setStateLoading(true);
    try {
      const info = await getBountyOnChainInfo(bounty.appId);
      setOnChainStatus(info.status);
      setOnChainWorker(info.worker);
      // If the on-chain status shows claimed by this user, mark claim as done
      if (
        activeAddress &&
        info.worker.toLowerCase() === activeAddress.toLowerCase() &&
        info.status >= 1
      ) {
        setClaimSuccess(true);
      }
    } catch (err) {
      console.error("Failed to fetch on-chain bounty state:", err);
    } finally {
      setStateLoading(false);
    }
  };

  // Load submissions and on-chain state whenever bounty changes
  useEffect(() => {
    if (bounty) {
      setResponses(getSubmissionsForBounty(bounty.id));
      fetchOnChainState();
    }
  }, [bounty, activeAddress]);

  const handleSubmit = async () => {
    await handleSubmitWork();
  };

  const handleClaimWork = async () => {
    if (!bounty?.appId || !activeAddress || !transactionSigner) {
      setClaimError("Wallet not connected or contract not found.");
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      console.log("Claiming work on-chain", { appId: bounty.appId, sender: activeAddress });
      await callClaimMethod(bounty.appId, activeAddress, transactionSigner);
      console.log("Claim work transaction sent");
      setClaimSuccess(true);
      // Refresh on-chain state so submit form becomes available
      await fetchOnChainState();
    } catch (err: any) {
      const raw = err?.message || err?.toString() || "";
      let errorMsg: string;
      if (raw.includes("assert failed") || raw.includes("logic eval error")) {
        // Refresh on-chain state to understand the actual problem
        try { await fetchOnChainState(); } catch (_) {}
        if (onChainStatus === 1 || onChainStatus === 2 || onChainStatus === 3) {
          errorMsg = "This bounty has already been claimed" +
            (onChainStatus === 2 ? " and work was submitted." :
             onChainStatus === 3 ? " and has been approved." : " by another worker.");
          setClaimSuccess(onChainStatus >= 1 && isClaimedByMe);
        } else {
          errorMsg = "Cannot claim this bounty. It may already be claimed or no longer available.";
        }
      } else {
        errorMsg = raw || "Failed to claim work. See console for details.";
      }
      setClaimError(errorMsg);
      console.error("Claim work error:", err);
    } finally {
      setClaiming(false);
    }
  };

  const handleApprove = (subId: string) => {
    approveSubmission(subId);
    setResponses(getSubmissionsForBounty(bounty.id));
  };

  const handleSubmitWork = async () => {
    if (!bounty?.appId || !activeAddress || !transactionSigner) {
      setSubmitError("Wallet not connected or contract not found.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      console.log("Submitting work on-chain", { appId: bounty.appId, sender: activeAddress });
      await callSubmitWorkMethod(bounty.appId, activeAddress, transactionSigner);
      console.log("Submit work transaction sent");
      setSubmitSuccess(true);
      setSubmitText("");
      addSubmission(bounty.id, activeAddress, submitText.trim());
      setResponses(getSubmissionsForBounty(bounty.id));
    } catch (err: any) {
      const raw = err?.message || err?.toString() || "";
      let errorMsg: string;
      if (raw.includes("pc=322") || raw.includes("assert failed")) {
        if (!isClaimedByMe) {
          errorMsg = "You must claim this bounty before submitting work. Click 'Claim Work' first.";
        } else if (onChainStatus === 2) {
          errorMsg = "Work has already been submitted for this bounty.";
        } else if (onChainStatus === 3) {
          errorMsg = "This bounty has already been approved.";
        } else {
          errorMsg = "Contract assertion failed. The bounty may not be in the correct state for submission.";
        }
      } else {
        errorMsg = raw || "Failed to submit work. See console for details.";
      }
      setSubmitError(errorMsg);
      console.error("Submit work error:", err);
      setSubmitSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveWork = async (subId: string) => {
    if (!bounty?.appId || !activeAddress || !transactionSigner) return;
    const workerAddress = responses.find(r => r.id === subId)?.submitter;
    if (!workerAddress) {
      setApproveResult({ success: false, error: "Worker address not found for approval." });
      return;
    }
    setApproving(true);
    setApproveResult(null);
    try {
      const txId = await callApproveMethod(bounty.appId, activeAddress, transactionSigner, workerAddress);
      console.log(`Approve transaction sent! App ID: ${bounty.appId}, Tx ID: ${txId}`);
      setApproveResult({ success: true, appId: bounty.appId, txId });
      handleApprove(subId);
    } catch (err: any) {
      console.error("Approve failed:", err);
      setApproveResult({ success: false, error: err?.message || String(err) });
    } finally {
      setApproving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/15 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="relative w-full max-w-4xl my-8 mx-4 rounded-2xl glass-modal overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ─── Header ─── */}
          <div className="border-b border-slate-200/60 px-6 py-5 md:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                {/* Sponsor logo placeholder */}
                <div className="h-12 w-12 shrink-0 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {(bounty.sponsor || "A")[0]}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-bold text-foreground leading-tight mb-1.5">
                    {bounty.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{bounty.sponsor || bounty.creator}</span>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-primary" /> Bounty
                    </span>
                    <span className="text-border">|</span>
                    <span className={`flex items-center gap-1.5 ${diff.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${diff.dot}`} />
                      {bounty.status}
                    </span>
                    {bounty.appId != null && (
                      <>
                        <span className="text-border">|</span>
                        <span className="flex items-center gap-1 font-mono text-xs">
                          App ID: {bounty.appId}
                        </span>
                      </>
                    )}
                    {bounty.region && (
                      <>
                        <span className="text-border">|</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {bounty.region}
                        </span>
                      </>
                    )}
                    {comments > 0 && (
                      <>
                        <span className="text-border">|</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" /> {comments}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                  <Bookmark className="h-4 w-4" /> Bookmark
                </button>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ─── Body: sidebar + main ─── */}
          <div className="flex flex-col md:flex-row">
            {/* Left sidebar */}
            <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-slate-200/60 p-6 md:p-8 space-y-6">
              {/* Prizes */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Prizes
                </h4>
                {/* Total */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <span className="font-display text-xl font-bold text-foreground">
                      {bounty.totalPrize || bounty.reward}
                    </span>
                    <span className="block text-xs text-muted-foreground">Total Prizes</span>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-2.5 border-t border-border pt-3">
                  {prizes.map((p) => (
                    <div key={p.place} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${placeColors[p.place] ? placeColors[p.place].replace("text-", "bg-") : "bg-muted-foreground"}`} />
                      <span className="font-display font-semibold text-foreground text-sm">
                        {p.amount}
                      </span>
                      <span className="text-xs text-muted-foreground">{p.place}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-4 border-t border-border pt-5">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-display font-bold text-foreground text-lg">{submissions}</span>
                    <span className="block text-xs text-muted-foreground uppercase tracking-wide">Submissions</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-display font-bold text-foreground text-lg">{remaining}</span>
                    <span className="block text-xs text-muted-foreground uppercase tracking-wide">Remaining</span>
                  </div>
                </div>
              </div>

              {/* Action buttons — conditional on role */}
              {!isOwner && (
                <div className="space-y-3">
                  {claimError && (
                    <div className="text-red-600 text-xs font-semibold text-center mb-2">{claimError}</div>
                  )}
                  {/* Only show Claim button when bounty is Open (status=0) or we haven't loaded state yet */}
                  {(onChainStatus === null || onChainStatus === 0) && !claimSuccess && (
                    <Button
                      variant="outline"
                      className="w-full font-semibold h-12 text-[15px] border-emerald-400/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-500"
                      onClick={handleClaimWork}
                      disabled={claiming || stateLoading}
                    >
                      {claiming ? "Claiming..." : stateLoading ? "Loading..." : "Claim Work"}
                      <Trophy className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  {/* Claimed state */}
                  {(claimSuccess || (onChainStatus === 1 && isClaimedByMe)) && (
                    <div>
                      <Button
                        variant="outline"
                        className="w-full font-semibold h-12 text-[15px] border-emerald-500 bg-emerald-500/10 text-emerald-500 cursor-not-allowed"
                        disabled
                      >
                        ✓ Work Claimed
                      </Button>
                      <p className="text-xs text-muted-foreground text-center mt-1">Submit your work in the panel on the right.</p>
                    </div>
                  )}
                  {/* Someone else claimed */}
                  {onChainStatus === 1 && !isClaimedByMe && (
                    <div className="text-amber-600 text-xs font-semibold text-center">
                      This bounty has been claimed by another worker.
                    </div>
                  )}
                  {/* Show success message if just submitted */}
                  {(submitSuccess || onChainStatus === 2) && (
                    <div className="mt-3 text-green-600 text-sm font-semibold text-center">
                      ✓ Work submitted — awaiting review.
                    </div>
                  )}
                  {/* Approved */}
                  {onChainStatus === 3 && (
                    <div className="mt-3 text-emerald-600 text-sm font-semibold text-center">
                      ✓ Bounty approved & paid out.
                    </div>
                  )}
                </div>
              )}

              {isOwner && (
                <div className="border-t border-border pt-5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    You are the publisher
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Review submissions in the panel on the right.
                  </p>
                </div>
              )}

              {/* Region */}
              {bounty.region && (
                <div className="border-t border-border pt-5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Regional Listing
                  </h4>
                  <p className="text-sm text-foreground">
                    This listing is open for people in <span className="font-semibold">{bounty.region}</span>
                  </p>
                </div>
              )}

              {/* Skills */}
              {skills.length > 0 && (
                <div className="border-t border-border pt-5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Skills Needed
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right content */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[70vh]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Details
              </h3>

              {bounty.details ? (
                <RichText text={bounty.details} />
              ) : (
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  {bounty.description}
                </p>
              )}

              {/* Requirements */}
              {bounty.requirements && bounty.requirements.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-foreground mb-3">Requirements</h3>
                  <ul className="space-y-2.5">
                    {bounty.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[15px] text-muted-foreground">
                        <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Owner view: list of submissions ── */}
              {isOwner && (
                <div className="mt-10 border-t border-border pt-6">
                  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Submissions ({responses.length})
                  </h3>

                  {responses.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No submissions yet. Share this bounty to attract participants!
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {responses.map((sub) => (
                        <div
                          key={sub.id}
                          className={`rounded-xl border p-4 transition-colors ${
                            sub.status === "approved"
                              ? "border-emerald-400/50 bg-emerald-50/40"
                              : "border-border bg-white/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-blue-400 flex items-center justify-center">
                                <User className="h-4 w-4 text-white" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-mono text-muted-foreground mb-1">
                                  {sub.submitter.slice(0, 8)}...{sub.submitter.slice(-6)}
                                </p>
                                <p className="text-sm text-foreground break-words">{sub.content}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(sub.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0">
                              {sub.status === "approved" ? (
                                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                  <CheckCircle2 className="h-4 w-4" /> Approved
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={async () => { await handleApproveWork(sub.id); }}
                                  disabled={approving}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-8 px-3 disabled:opacity-50"
                                >
                                  {approving ? (
                                    <span className="flex items-center gap-1">
                                      <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      Approving...
                                    </span>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                      Approve
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Approval transaction result banner */}
                  {approveResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-4 rounded-xl border p-4 ${
                        approveResult.success
                          ? "border-emerald-400/50 bg-emerald-50/60"
                          : "border-red-400/50 bg-red-50/60"
                      }`}
                    >
                      {approveResult.success ? (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            <span className="font-bold text-emerald-700">Bounty Approved & Payment Sent!</span>
                          </div>
                          <div className="space-y-2 bg-white/70 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">App ID</span>
                              <span className="font-mono font-semibold text-foreground">{approveResult.appId}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground shrink-0">Transaction ID</span>
                              <a
                                href={`https://testnet.explorer.perawallet.app/tx/${approveResult.txId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-xs text-violet-600 hover:text-violet-800 underline underline-offset-2 truncate"
                              >
                                {approveResult.txId}
                              </a>
                            </div>
                          </div>
                          <p className="text-xs text-emerald-600 mt-2">The escrowed ALGO has been transferred to the worker&apos;s wallet.</p>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <X className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-red-700">Approval Failed</span>
                            <p className="text-sm text-red-600 mt-1 break-words">{approveResult.error}</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── Participant view: submit response form ── */}
              {!isOwner && activeAddress && bounty.creatorAddress && (
                <div className="mt-10 border-t border-border pt-6">
                  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" />
                    Submit Your Work
                  </h3>

                  {/* Loading on-chain state */}
                  {stateLoading && (
                    <p className="text-sm text-muted-foreground italic">Checking bounty status...</p>
                  )}

                  {/* Not claimed yet — prompt user to claim first */}
                  {!stateLoading && !isClaimedByMe && !submitSuccess && onChainStatus !== 2 && onChainStatus !== 3 && (
                    <div className="rounded-xl border border-amber-300/50 bg-amber-50/40 p-4 text-center">
                      <p className="text-sm text-amber-700 font-medium">You must claim this bounty before you can submit work.</p>
                      <p className="text-xs text-amber-600 mt-1">Click "Claim Work" on the left panel first.</p>
                    </div>
                  )}

                  {/* Already submitted on-chain */}
                  {!stateLoading && onChainStatus === 2 && (
                    <div className="rounded-xl border border-blue-300/50 bg-blue-50/40 p-4 text-center">
                      <p className="text-sm text-blue-700 font-medium">Work has already been submitted for this bounty.</p>
                      <p className="text-xs text-blue-600 mt-1">Waiting for the creator to review and approve.</p>
                    </div>
                  )}

                  {/* Already approved */}
                  {!stateLoading && onChainStatus === 3 && (
                    <div className="rounded-xl border border-emerald-300/50 bg-emerald-50/40 p-4 text-center">
                      <p className="text-sm text-emerald-700 font-medium">This bounty has been approved and paid out.</p>
                    </div>
                  )}

                  {/* Claimed and ready to submit */}
                  {!stateLoading && isClaimedByMe && !submitSuccess && onChainStatus === 1 && !responses.some((s) => s.submitter === activeAddress) && (
                    <>
                      <textarea
                        value={submitText}
                        onChange={(e) => setSubmitText(e.target.value)}
                        placeholder="Paste a link to your work or describe your submission..."
                        rows={4}
                        className="w-full rounded-xl border border-border bg-white/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      />
                      {submitError && (
                        <div className="mt-2 text-red-600 text-xs font-semibold">{submitError}</div>
                      )}
                      <Button
                        onClick={handleSubmitWork}
                        disabled={!submitText.trim() || submitting}
                        className="mt-3 w-full gradient-primary text-primary-foreground font-semibold glow-primary h-12 text-[15px]"
                      >
                        {submitting ? "Submitting..." : "Submit Work"}
                        <Send className="ml-2 h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {/* Just submitted successfully */}
                  {submitSuccess && (
                    <div className="rounded-xl border border-emerald-300/50 bg-emerald-50/40 p-4 text-center">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
                      <p className="text-sm text-emerald-700 font-semibold">Work submitted successfully!</p>
                      <p className="text-xs text-emerald-600 mt-1">The bounty creator will review your submission.</p>
                    </div>
                  )}

                  {/* Show own past submissions */}
                  {responses.filter((s) => s.submitter === activeAddress).length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Your Submissions
                      </h4>
                      <div className="space-y-3">
                        {responses
                          .filter((s) => s.submitter === activeAddress)
                          .map((sub) => (
                            <div key={sub.id} className="rounded-lg border border-border bg-white/40 p-3">
                              <p className="text-sm text-foreground break-words">{sub.content}</p>
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-muted-foreground">
                                  {new Date(sub.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                                <span
                                  className={`text-xs font-semibold ${
                                    sub.status === "approved"
                                      ? "text-emerald-600"
                                      : sub.status === "rejected"
                                        ? "text-rose-500"
                                        : "text-amber-500"
                                  }`}
                                >
                                  {sub.status === "approved"
                                    ? "✓ Approved"
                                    : sub.status === "rejected"
                                      ? "✗ Rejected"
                                      : "⏳ Pending"}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BountyDetailModal;
