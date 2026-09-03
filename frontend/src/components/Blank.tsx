import { motion } from "framer-motion";
import { Shield, Sparkles } from "lucide-react";

interface Props {
  busy?: boolean;
}

export default function Blank({ busy }: Props) {
  return (
    <div className="empty-canvas">
      <motion.div
        className="empty-icon"
        animate={{
          scale: [1, 1.05, 1],
          boxShadow: [
            "0 0 20px rgba(59, 130, 246, 0.2)",
            "0 0 40px rgba(59, 130, 246, 0.4)",
            "0 0 20px rgba(59, 130, 246, 0.2)",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Shield size={32} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h3 className="empty-title">
          {busy ? "Reconstructing Fund Flow..." : "Awaiting Investigation"}
        </h3>
        <p className="empty-subtext">
          {busy
            ? "Gathering block data from Ethereum mainnet and querying attribution registries..."
            : "Enter a target wallet address in the investigation console to reconstruct the on-chain money trail."}
        </p>
      </motion.div>

      {!busy && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--color-cyan)" }}>
          <Sparkles size={14} />
          <span>Supports Ethereum mainnet transfers & exchange attribution</span>
        </div>
      )}
    </div>
  );
}
