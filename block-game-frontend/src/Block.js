import "./App.css";

export default function Block({ block, onClick }) {
  return (
    <div
      className="block"
      style={{ backgroundColor: block.color || "white" }}
      onClick={() => onClick(block)}
    >
      {block.owner || ""}
    </div>
  );
}
