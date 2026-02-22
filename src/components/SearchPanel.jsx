export default function SearchPanel({ query, onQueryChange, messages }) {
  return (
    <div className="right">
      <div className="right-header">Search</div>
      <div className="search-container">
        <input
          className="search-input"
          type="text"
          placeholder="Search keyword..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <div className="chat-output">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.type === 'system' ? 'system' : ''}`}>
            {msg.text}
          </div>
        ))}
      </div>
    </div>
  );
}
