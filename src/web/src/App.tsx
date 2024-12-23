import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
      <h1 className="text-3xl font-bold underline">
          <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
      </h1>
  )
}

export default App
