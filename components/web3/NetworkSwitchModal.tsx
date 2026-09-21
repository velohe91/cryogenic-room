"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useSwitchChain } from "wagmi";
import { SUPPORTED_CHAINS, getChainBadgeLabel } from "../../lib/web3/config";

type Props = { open: boolean; onClose: () => void };

export function NetworkSwitchModal({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const { chain } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="cryo-web3-backdrop" onClick={onClose}>
      <div className="cryo-web3-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="cryo-web3-close" type="button" onClick={onClose}>×</button>
        <span className="cryo-web3-eyebrow">CRYOGENIC ROOM // NETWORK</span>
        <h2>SWITCH NETWORK</h2>
        <div className="cryo-web3-network-list">
          {SUPPORTED_CHAINS.map((supportedChain) => {
            const active = chain?.id === supportedChain.id;
            return (
              <button
                key={supportedChain.id}
                type="button"
                disabled={isPending}
                className={active ? "active" : ""}
                onClick={() => {
                  if (active) return onClose();
                  switchChain({ chainId: supportedChain.id }, { onSuccess: onClose });
                }}
              >
                <span>{getChainBadgeLabel(supportedChain.id, supportedChain.name)}</span>
                {active && <small>ACTIVE</small>}
              </button>
            );
          })}
        </div>
        <button className="cryo-web3-secondary" type="button" onClick={onClose}>CLOSE</button>
      </div>
    </div>,
    document.body,
  );
}
