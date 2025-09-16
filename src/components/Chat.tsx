import React, { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import config from '../config/app.config';

interface Message {
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
}

// Configure marked for clean markdown rendering
marked.setOptions({
  breaks: true,
  gfm: true
});

const TypingIndicator: React.FC<{ elapsedTime: number }> = ({ elapsedTime }) => (
  <div className="flex items-center gap-3 p-2">
    <div className="flex gap-1">
      <span className="w-2 h-2 bg-loading-dot rounded-full animate-typing"></span>
      <span className="w-2 h-2 bg-loading-dot rounded-full animate-typing-delay-1"></span>
      <span className="w-2 h-2 bg-loading-dot rounded-full animate-typing-delay-2"></span>
    </div>
    <span className="text-loading-timer text-sm font-medium min-w-[35px]">
      {elapsedTime}s
    </span>
  </div>
);

const MessageContent: React.FC<{ message: Message; isLoading?: boolean; elapsedTime?: number }> = ({ 
  message, 
  isLoading = false, 
  elapsedTime = 0 
}) => {
  if (message.type === 'assistant' && message.content === '' && isLoading) {
    return <TypingIndicator elapsedTime={elapsedTime} />;
  }
  
  if (message.type === 'assistant' && message.content) {
    return (
      <div 
        className="prose prose-xl max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-xl"
        dangerouslySetInnerHTML={{ __html: marked(message.content) }}
      />
    );
  }
  
  return <div className="whitespace-pre-wrap break-words text-xl">{message.content}</div>;
};

const MessageBubble: React.FC<{ message: Message; isLoading?: boolean; elapsedTime?: number }> = ({ 
  message, 
  isLoading, 
  elapsedTime 
}) => {
  // Different layouts for user vs assistant messages
  if (message.type === 'assistant' || message.type === 'error') {
    // Assistant/System messages - full width like Claude
    return (
      <div className="mb-8 animate-slide-in">
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-lg font-medium text-muted-foreground">
            {message.type === 'assistant' ? 'Assistant' : 'System'}
          </span>
          <span className="text-sm text-muted-foreground">
            {message.timestamp}
          </span>
        </div>
        <div className="text-xl text-foreground">
          <MessageContent message={message} isLoading={isLoading} elapsedTime={elapsedTime} />
        </div>
      </div>
    );
  }
  
  // User messages - bubble style on the right
  return (
    <div className="mb-6 animate-slide-in">
      <div className="flex items-center gap-2 mb-2 px-1 justify-end">
        <span className="text-lg font-medium text-muted-foreground">
          You
        </span>
        <span className="text-sm text-muted-foreground">
          {message.timestamp}
        </span>
      </div>
      <div className="bg-gray-100 text-gray-800 ml-auto max-w-[70%] rounded-lg rounded-br-sm p-6 text-xl">
        <MessageContent message={message} isLoading={isLoading} elapsedTime={elapsedTime} />
      </div>
    </div>
  );
};

const SendIcon: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
  </svg>
);

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingElapsedTime, setLoadingElapsedTime] = useState(0);
  
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const loadingStartTimeRef = useRef<number | null>(null);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Smooth streaming refs
  const streamBufferRef = useRef<string[]>([]);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentContentRef = useRef<string>('');
  const isInResponseTagRef = useRef<boolean>(false);
  const responseContentRef = useRef<string>('');
  const finalContentRef = useRef<string>('');
  const hasSeenTagsRef = useRef<boolean>(false);

  const scrollToBottom = useCallback(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, []);

  // Smooth streaming function - processes buffer gradually
  const startSmoothStream = useCallback((assistantMessage: Message) => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }
    
    const CHARS_PER_INTERVAL = 8; // Characters to add per interval
    const INTERVAL_MS = 10; // Milliseconds between updates
    
    streamIntervalRef.current = setInterval(() => {
      if (streamBufferRef.current.length > 0) {
        const chunk = streamBufferRef.current.shift() || '';
        currentContentRef.current += chunk;
        
        setMessages(prev => [
          ...prev.slice(0, -1),
          { ...assistantMessage, content: currentContentRef.current }
        ]);
        
        scrollToBottom();
      }
    }, INTERVAL_MS);
  }, [scrollToBottom]);

  const stopSmoothStream = useCallback(() => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    // Flush remaining buffer
    if (streamBufferRef.current.length > 0) {
      currentContentRef.current += streamBufferRef.current.join('');
      streamBufferRef.current = [];
    }
  }, []);

  const formatTimestamp = (): string => {
    return new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const startLoadingTimer = useCallback(() => {
    loadingStartTimeRef.current = Date.now();
    setLoadingElapsedTime(0);
    
    loadingIntervalRef.current = setInterval(() => {
      if (loadingStartTimeRef.current) {
        const elapsed = ((Date.now() - loadingStartTimeRef.current) / 1000).toFixed(1);
        setLoadingElapsedTime(parseFloat(elapsed));
      }
    }, 100);
  }, []);

  const stopLoadingTimer = useCallback(() => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
    loadingStartTimeRef.current = null;
    setLoadingElapsedTime(0);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message immediately
    const userMessageObj: Message = {
      type: 'user',
      content: userMessage,
      timestamp: formatTimestamp()
    };
    
    setMessages(prev => [...prev, userMessageObj]);
    
    // Start loading state
    setIsLoading(true);
    startLoadingTimer();
    
    // Add empty assistant message for streaming
    const assistantMessage: Message = {
      type: 'assistant',
      content: '',
      timestamp: formatTimestamp()
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    
    // Reset stream state
    currentContentRef.current = '';
    streamBufferRef.current = [];
    isInResponseTagRef.current = false;
    responseContentRef.current = '';
    finalContentRef.current = '';
    hasSeenTagsRef.current = false;
    startSmoothStream(assistantMessage);
    
    try {
      console.log('🚀 Sending request to:', config.CHAT_WEBHOOK);
      console.log('📤 Request payload:', { message: userMessage, id: config.CHAT_USER_ID });
      
      const response = await fetch(config.CHAT_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          id: config.CHAT_USER_ID
        })
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }
      
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';
      
      console.log('🔵 Starting SSE stream reading...');
      
      // Check if response might be JSON array instead of SSE
      let isJsonArray = false;
      let firstChunk = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('🔴 Stream reading done');
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        console.log('📦 Raw chunk received:', chunk);
        
        // Check if first chunk starts with [ (JSON array)
        if (!firstChunk && chunk.trim().startsWith('[')) {
          isJsonArray = true;
          console.log('🔄 Detected JSON array response from n8n');
        }
        firstChunk += chunk;
        
        buffer += chunk;
        
        // Process each line immediately as it becomes complete
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        console.log(`📝 Processing ${lines.length} lines from buffer`);
        
        for (const line of lines) {
          console.log('📍 Processing line:', line);
          if (line.trim()) {
            try {
              const data = JSON.parse(line.trim());
              console.log('✅ Successfully parsed SSE data:', data);
              
              if (data.type === 'item' && data.content) {
                // Check if content is a JSON with output property (n8n format)
                let content = data.content;
                try {
                  const parsed = JSON.parse(data.content);
                  if (parsed.output) {
                    content = parsed.output;
                  }
                } catch (e) {
                  // Not JSON, use as is
                }
                
                // Check for response tags
                if (content === '<response>') {
                  console.log('📌 Start of <response> tag detected');
                  hasSeenTagsRef.current = true;
                  isInResponseTagRef.current = true;
                  responseContentRef.current = '';
                } else if (content === '</response>') {
                  console.log('📌 End of </response> tag detected');
                  isInResponseTagRef.current = false;
                  // Keep the accumulated content
                  responseContentRef.current = currentContentRef.current;
                } else if (content.includes('<end>') && content.includes('</end>')) {
                  // Extract content between <end> tags
                  const startIdx = content.indexOf('<end>') + 5;
                  const endIdx = content.indexOf('</end>');
                  const finalContent = content.substring(startIdx, endIdx).trim();
                  console.log('🎯 Final content in <end> tags:', finalContent);
                  
                  // Stop streaming and clear buffer
                  stopSmoothStream();
                  
                  // Wait a bit for any remaining buffer to process
                  setTimeout(() => {
                    currentContentRef.current = finalContent;
                    setMessages(prev => [
                      ...prev.slice(0, -1),
                      { ...assistantMessage, content: finalContent }
                    ]);
                    
                    // Mark as complete
                    setIsLoading(false);
                    stopLoadingTimer();
                    scrollToBottom();
                  }, 100);
                  
                  // Break the while loop
                  break;
                } else if (isInResponseTagRef.current) {
                  // Inside response tags - show content
                  const chars = content.split('');
                  streamBufferRef.current.push(...chars);
                } else if (!isInResponseTagRef.current && hasSeenTagsRef.current && !content.includes('<')) {
                  // After </response> but before <end> - ignore when we've seen tags
                  console.log('📍 Ignoring content between </response> and <end>:', content);
                } else if (!hasSeenTagsRef.current) {
                  // No tags seen yet - normal streaming mode
                  const chars = content.split('');
                  streamBufferRef.current.push(...chars);
                }
              } else if (data.type === 'final' || data.type === 'replace') {
                // Stop smooth streaming and replace with final content
                stopSmoothStream();
                console.log('Replacing with final content:', data.content);
                currentContentRef.current = data.content;
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  { ...assistantMessage, content: data.content }
                ]);
                setTimeout(() => scrollToBottom(), 0);
              } else if (data.type === 'end') {
                console.log('🏁 Received end signal from node:', data.metadata?.nodeName);
                
                // If we haven't seen any tags, this is a normal stream - end here
                if (!hasSeenTagsRef.current) {
                  console.log('📍 No tags detected, ending normal stream');
                  stopSmoothStream();
                  
                  // Wait for buffer to finish
                  setTimeout(() => {
                    if (currentContentRef.current) {
                      setMessages(prev => [
                        ...prev.slice(0, -1),
                        { ...assistantMessage, content: currentContentRef.current }
                      ]);
                    }
                    setIsLoading(false);
                    stopLoadingTimer();
                  }, 100);
                  
                  return;
                }
                // Otherwise, if we've seen tags, continue processing to find <end></end>
              } else {
                console.log('⚠️ Unknown message type:', data.type);
              }
            } catch (e) {
              console.error('❌ Error parsing JSON:', e, 'Line:', line);
            }
          }
        }
        
        // Small delay to allow React to process state updates
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      // Process any remaining data in buffer
      console.log('🔶 Final buffer check:', buffer);
      if (buffer.trim()) {
        try {
          // Check if it's a JSON array from n8n
          if (buffer.trim().startsWith('[')) {
            const jsonArray = JSON.parse(buffer.trim());
            console.log('📋 Parsed JSON array from n8n:', jsonArray);
            
            // Process each item in the array
            for (const item of jsonArray) {
              const data = item.json || item;
              console.log('🔸 Processing array item:', data);
              
              if (data.type === 'item' && data.content) {
                const chars = data.content.split('');
                streamBufferRef.current.push(...chars);
              } else if (data.type === 'replace' || data.type === 'final') {
                stopSmoothStream();
                currentContentRef.current = data.content;
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  { ...assistantMessage, content: data.content }
                ]);
              }
            }
          } else {
            // Try parsing as single object
            const data = JSON.parse(buffer.trim());
            console.log('📋 Final buffer parsed:', data);
            if (data.type === 'item' && data.content) {
              const chars = data.content.split('');
              streamBufferRef.current.push(...chars);
            }
          }
        } catch (e) {
          console.error('❌ Error parsing final buffer:', e, 'Buffer content:', buffer);
        }
      }
      
      // Wait for buffer to empty (only if we didn't receive <end> tag)
      if (!finalContentRef.current) {
        while (streamBufferRef.current.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        stopSmoothStream();
        
        // If we never received an <end> tag, complete normally
        setIsLoading(false);
        stopLoadingTimer();
      }
    } catch (error) {
      console.error('Error:', error);
      stopSmoothStream();
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          type: 'error',
          content: 'Error connecting to server. Please try again.',
          timestamp: formatTimestamp()
        }
      ]);
    } finally {
      setIsLoading(false);
      stopLoadingTimer();
    }
  }, [inputMessage, isLoading, scrollToBottom, startLoadingTimer, stopLoadingTimer]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-background font-tinos">
      {/* Header */}
      <header className="border-b border-light bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Kelsenia</h1>
          <span className="text-sm text-muted-foreground border border-light px-3 py-1 rounded-md">
            {config.CHAT_USER_ID}
          </span>
        </div>
      </header>
      
      {/* Messages Container */}
      <div 
        ref={messageContainerRef}
        className="flex-1 overflow-y-auto px-6 py-6 scrollbar-elegant"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <p className="text-lg">Start a conversation by typing a message below.</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageBubble 
              key={index} 
              message={message} 
              isLoading={isLoading && index === messages.length - 1}
              elapsedTime={loadingElapsedTime}
            />
          ))
        )}
      </div>
      
      {/* Input Container */}
      <div className="border-t border-light bg-card px-6 py-4">
        <div className="flex gap-4 items-end">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none border-elegant rounded-md px-6 py-5 text-xl bg-background focus:outline-none focus:ring-2 focus:ring-foreground disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground"
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-foreground text-background px-10 py-5 rounded-md border-elegant hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 flex items-center justify-center min-w-[100px]"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-background border-t-transparent rounded-full animate-spin" />
            ) : (
              <SendIcon />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;