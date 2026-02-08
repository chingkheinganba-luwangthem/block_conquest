import Block from "./Block";
import "./App.css";

export default function Grid({ blocks, onBlockClick }) {
  return (
    <div className="grid-wrapper">
      <div className="grid">
        {blocks.map(block => (
          <Block 
            key={block.id} 
            block={block} 
            onClick={() => onBlockClick(block)} 
          />
        ))}
      </div>
    </div>
  );
}
