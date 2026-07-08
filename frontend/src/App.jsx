import { useMemo, useState } from 'react'
import './App.css'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const wsBase = apiBase.replace(/^http/, 'ws')

function App() {
  const [order, setOrder] = useState({ customer_name: '', item: '', quantity: 1 })
  const [updates, setUpdates] = useState([])
  const [connected, setConnected] = useState(false)

  const websocketUrl = useMemo(() => `${wsBase}/ws/orders`, [])

  const connect = () => {
    const socket = new WebSocket(websocketUrl)
    socket.onopen = () => {
      setConnected(true)
      socket.send('subscribe')
    }
    socket.onclose = () => setConnected(false)
    socket.onmessage = (event) => {
      const next = JSON.parse(event.data)
      setUpdates((existing) => [next, ...existing].slice(0, 10))
    }
  }

  const submitOrder = async (event) => {
    event.preventDefault()
    await fetch(`${apiBase}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: order.customer_name,
        item: order.item,
        quantity: Number(order.quantity),
      }),
    })
    setOrder((current) => ({ ...current, item: '', quantity: 1 }))
  }

  return (
    <main className="layout">
      <h1>Real-time Food Delivery</h1>
      <button type="button" onClick={connect} disabled={connected}>
        {connected ? 'Connected to live updates' : 'Connect WebSocket'}
      </button>

      <form onSubmit={submitOrder}>
        <input
          required
          placeholder="Customer"
          value={order.customer_name}
          onChange={(event) => setOrder((current) => ({ ...current, customer_name: event.target.value }))}
        />
        <input
          required
          placeholder="Food item"
          value={order.item}
          onChange={(event) => setOrder((current) => ({ ...current, item: event.target.value }))}
        />
        <input
          required
          min="1"
          type="number"
          value={order.quantity}
          onChange={(event) => setOrder((current) => ({ ...current, quantity: event.target.value }))}
        />
        <button type="submit">Place order</button>
      </form>

      <section>
        <h2>Live order stream</h2>
        <ul>
          {updates.map((entry) => (
            <li key={entry.id}>
              {entry.customer_name} ordered {entry.quantity}x {entry.item} ({entry.status})
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
