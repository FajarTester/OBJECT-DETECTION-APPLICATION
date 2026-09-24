import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import axios from "axios";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Halo! Ada yang bisa saya bantu terkait pantauan visual objek saat ini?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll ke pesan paling bawah setiap kali ada chat baru
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/chatbot`,
        {
          message: userText,
        },
      );
      const data = response.data;

      if (data.status === "success") {
        setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: "Maaf, sistem AI sedang mengalami gangguan." },
        ]);
      }
    } catch (error) {
      console.error("ChatWidget Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Error: Tidak dapat terhubung ke backend server. Silakan coba lagi.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end w-full max-w-[calc(100%-2rem)] sm:w-auto">
      {/* 1. Jendela Chatbox (Responsif & Efek Blur Biru Tua Kehitaman) */}
      {isOpen && (
        <Card className="w-[calc(100vw-2rem)] sm:w-96 h-[380px] sm:h-[500px] mb-4 shadow-2xl flex flex-col border border-slate-800 bg-slate-950/75 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 bg-slate-900/90 text-slate-100 border-b border-slate-800 rounded-t-xl">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Chatbot Vision Assistant
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-slate-800 text-slate-400 hover:text-slate-100"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          {/* Area Isi Chatbox */}
          <CardContent className="flex-1 p-4 overflow-hidden bg-transparent">
            <ScrollArea className="h-full pr-3">
              <div className="flex flex-col gap-3">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                          : "bg-slate-900/80 border border-slate-800 text-slate-200 shadow-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* Indikator Loading Skleton / Typing */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-900/80 border border-slate-800 text-slate-400 max-w-[85%] rounded-lg px-3 py-2 text-sm animate-pulse flex items-center gap-1">
                      AI sedang berpikir
                      <span className="dot animate-bounce delay-75">.</span>
                      <span className="dot animate-bounce delay-150">.</span>
                      <span className="dot animate-bounce delay-300">.</span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
          </CardContent>

          {/* Input Footer */}
          <CardFooter className="p-3 border-t border-slate-800 bg-slate-900/40">
            <div className="flex w-full items-center space-x-2">
              <Input
                type="text"
                placeholder="Tanya jumlah objek..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 bg-slate-900/60 border-slate-700 text-slate-200 placeholder-slate-500 focus-visible:ring-blue-500 text-sm h-9"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={isLoading}
                className="h-9 w-9 bg-blue-600 hover:bg-blue-500 text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* 2. Tombol Utama Melayang */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="lg"
        className="rounded-full shadow-lg h-12 px-6 gap-2 transform active:scale-95 transition-transform bg-blue-600 text-white hover:bg-blue-500"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageSquare className="h-5 w-5" />
        )}
        <span>{isOpen ? "Tutup" : "Tanya AI"}</span>
      </Button>
    </div>
  );
}
