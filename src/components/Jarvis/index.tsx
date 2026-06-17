'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Gutter } from '@payloadcms/ui'
import { Sparkles, Send, ArrowUp, Bot } from 'lucide-react'
import './index.scss'

interface Message {
  sender: 'user' | 'ai'
  text: string
}

const JarvisPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim()
    if (!text) return

    if (!textToSend) setInputText('')

    // Append user message
    setMessages((prev) => [...prev, { sender: 'user', text }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/widgets/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.message || `Error ${response.status}: Failed to get answer`)
      }

      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: data.message || 'No response from AI.' },
      ])
    } catch (err: any) {
      console.error(err)
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: err.message || 'Sorry, I failed to process that query. Please make sure the backend is active.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const suggestions = [
    { label: "Today's sales", text: "What is today's sales summary?" },
    { label: "Cheese Cake availability", text: "Do we have Packed Cheese Cake in stock?" },
    { label: "Yesterday's top items", text: "Show yesterday's top sold products" },
    { label: "Bingo Chips stock", text: "Is Bingo Original Salt available?" },
  ]

  return (
    <div className="jarvis-container">

      <Gutter className="jarvis-gutter">
        {messages.length === 0 ? (
          /* Empty Screen State (ChatGPT Style) */
          <div className="jarvis-empty-state">
            <div className="avatar-pulse">
              <Sparkles size={48} className="pulse-icon" />
            </div>
            <h1>How can I help you today?</h1>
            <p className="subtitle">Ask me about product pricing, stock availability, or sales statistics.</p>

            <div className="suggestions-grid">
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  className="suggestion-card"
                  onClick={() => handleSend(item.text)}
                >
                  <span className="card-label">{item.label}</span>
                  <span className="card-desc">"{item.text}"</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Active Chat Conversation Log */
          <div className="jarvis-chat-log">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-row ${msg.sender}`}>
                <div className="avatar-box">
                  {msg.sender === 'user' ? (
                    <span className="user-initial">U</span>
                  ) : (
                    <Bot size={16} />
                  )}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.text}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-row ai typing-row">
                <div className="avatar-box">
                  <Bot size={16} />
                </div>
                <div className="message-content">
                  <div className="typing-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </Gutter>

      {/* Centered Bottom Input Composer */}
      <div className="jarvis-input-area">
        <div className="input-box-wrapper">
          <input
            type="text"
            placeholder="Message JARVIS..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend()
            }}
            disabled={isLoading}
          />
          <button
            className={`send-btn ${inputText.trim() ? 'active' : ''}`}
            onClick={() => handleSend()}
            disabled={isLoading || !inputText.trim()}
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="disclaimer">
          JARVIS can make mistakes. Verify important sales and financial metrics.
        </p>
      </div>
    </div>
  )
}

export default JarvisPage
