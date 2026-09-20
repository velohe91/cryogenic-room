"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { getChainBadgeLabel } from "../../lib/web3/config";

function truncateAddress(address: string) {
  return address.length <= 10 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSwitchNetwork: () => void;
};

export function WalletAccountModal({ open, onClose, onSwitchNetwork }: Props) {
  const [mounted, setMounted] = useState(false);
  const { address, chain, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, query: { enabled: Boolean(address) } });
  const { disconnect } = useDisconnect();

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
        <span className="cryo-web3-eyebrow">CRYOGENIC ROOM // WALLET</span>
        <h2>WALLET ACCOUNT</h2>
        {isConnected && address ? (
          <div className="cryo-web3-card">
            <span className="cryo-web3-badge">{chain ? getChainBadgeLabel(chain.id, chain.name) : "UNKNOWN NETWORK"}</span>
            <strong>{truncateAddress(address)}</strong>
            <small>{balance ? `${Number(balance.formatted).toLocaleString("en-US", { maximumFractionDigits: 4 })} ${balance.symbol}` : "BALANCE UNAVAILABLE"}</small>
          </div>
        ) : (
          <p className="cryo-web3-copy">NO EVM WALLET CONNECTED.</p>
        )}
        <div className="cryo-web3-actions">
          <button type="button" onClick={() => { onClose(); onSwitchNetwork(); }}>SWITCH NETWORK</button>
          {isConnected && <button type="button" onClick={() => { disconnect(); onClose(); }}>DISCONNECT WALLET</button>}
          <button type="button" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
