"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { HAS_WALLETCONNECT_PROJECT_ID } from "../../lib/web3/config";
import { WalletAccountModal } from "./WalletAccountModal";
import { NetworkSwitchModal } from "./NetworkSwitchModal";

export function ConnectWalletButton() {
  const [accountOpen, setAccountOpen] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);

  return (
    <>
      <ConnectButton.Custom>
        {({ account, chain, openConnectModal, mounted }) => {
          if (!mounted) return <button className="factory-wallet-button" disabled>…</button>;

          if (!account || !chain) {
            return (
              <button
                className="factory-wallet-button"
                type="button"
                onClick={() => HAS_WALLETCONNECT_PROJECT_ID ? openConnectModal() : setEnvOpen(true)}
              >
                CONNECT WALLET
              </button>
            );
          }

          if (chain.unsupported) {
            return (
              <button className="factory-wallet-button" type="button" onClick={() => setNetworkOpen(true)}>
                SWITCH NETWORK
              </button>
            );
          }

          return (
            <button
              className="factory-wallet-button connected"
              type="button"
              title={account.address}
              onClick={() => setAccountOpen(true)}
            >
              {account.displayName}
            </button>
          );
        }}
      </ConnectButton.Custom>

      <WalletAccountModal open={accountOpen} onClose={() => setAccountOpen(false)} onSwitchNetwork={() => setNetworkOpen(true)} />
      <NetworkSwitchModal open={networkOpen} onClose={() => setNetworkOpen(false)} />

      {envOpen && (
        <MissingProjectIdModal onClose={() => setEnvOpen(false)} />
      )}
    </>
  );
}

function MissingProjectIdModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);
  if (!mounted) return null;

  return createPortal(
    <div className="cryo-web3-backdrop" onClick={onClose}>
      <div className="cryo-web3-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <span className="cryo-web3-eyebrow">CRYOGENIC ROOM // ENV</span>
        <h2>WALLETCONNECT PROJECT ID MISSING</h2>
        <p className="cryo-web3-copy">
          Add <code>NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code> to <code>.env.local</code> and restart the dev server.
        </p>
        <button className="cryo-web3-secondary" type="button" onClick={onClose}>CLOSE</button>
      </div>
    </div>,
    document.body,
  );
}
