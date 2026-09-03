export default function Blank({ busy }: { busy: boolean }) {
  return (
    <div className="blank">
      <div className="blank-diagram">
        <div className="blank-node is-victim">victim</div>
        <div className="blank-link" />
        <div className="blank-node">hop 1</div>
        <div className="blank-link" />
        <div className="blank-node">hop 2</div>
        <div className="blank-link" />
        <div className="blank-node is-exchange">exchange</div>
      </div>
      <p className="blank-copy">
        {busy
          ? 'Reading the chain and walking each hop outward. Live traces take a few seconds per hop.'
          : 'Enter the wallet address from a complaint to map where the funds moved and name the exchange now holding them.'}
      </p>
    </div>
  );
}
