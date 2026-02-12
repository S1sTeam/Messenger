export const ChatPage = () => {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '300px', borderRight: '1px solid #ccc', padding: '10px' }}>
        <h2>Чаты</h2>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
          <p>Выберите чат</p>
        </div>
        <div style={{ padding: '10px', borderTop: '1px solid #ccc' }}>
          <input type="text" placeholder="Сообщение..." style={{ width: '100%', padding: '10px' }} />
        </div>
      </div>
    </div>
  );
};
