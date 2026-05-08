"use client";

import React, { useState, useEffect } from "react";
import { Heart, MessageCircle, Send, X, LogIn, UserPlus } from "lucide-react";
import { useSession, signIn } from "next-auth/react";
import { Reveal } from "./BlogClient";
import { AnimatePresence, motion } from "framer-motion";

interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    name: string | null;
    image: string | null;
  };
}

interface SocialActionsProps {
  taskId: string;
  initialLikes: number;
  initialComments: number;
  initiallyLiked: boolean;
  theme: {
    isDark: boolean;
    accent: string;
  };
}

export const BlogSocial: React.FC<SocialActionsProps> = ({ 
  taskId, 
  initialLikes, 
  initialComments, 
  initiallyLiked,
  theme 
}) => {
  const { data: session } = useSession();
  const [liked, setLiked] = useState(initiallyLiked);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [commentsCount, setCommentsCount] = useState(initialComments);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleLike = async () => {
    // Optimistic update
    const prevLiked = liked;
    setLiked(!prevLiked);
    setLikesCount(prevLiked ? likesCount - 1 : likesCount + 1);

    try {
      const res = await fetch(`/api/blog/posts/${taskId}/like`, { method: "POST" });
      const data = await res.json();
      if (data.liked !== undefined) {
        setLiked(data.liked);
      }
    } catch (error) {
      setLiked(prevLiked);
      setLikesCount(initialLikes);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/blog/posts/${taskId}/comments`);
      const data = await res.json();
      setComments(data);
      setCommentsCount(data.length);
    } catch (error) {
      console.error("Failed to fetch comments");
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/blog/posts/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment })
      });
      const data = await res.json();
      setComments([...comments, data]);
      setCommentsCount(prev => prev + 1);
      setNewComment("");
    } catch (error) {
      console.error("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-8 mt-12">
        <button 
          onClick={handleLike}
          className={`flex items-center gap-2 group transition-all duration-300 ${liked ? 'text-red-500' : 'opacity-40 hover:opacity-100'}`}
        >
          <div className={`p-2.5 rounded-full transition-colors ${liked ? 'bg-red-500/10' : 'group-hover:bg-red-500/5'}`}>
            <Heart size={18} fill={liked ? "currentColor" : "none"} className={liked ? "scale-110" : "group-hover:scale-110 transition-transform"} />
          </div>
          <span className="text-[11px] font-black tracking-widest">{likesCount}</span>
        </button>

        <button 
          onClick={() => setShowComments(true)}
          className="flex items-center gap-2 group opacity-40 hover:opacity-100 transition-all duration-300"
        >
          <div className="p-2.5 rounded-full group-hover:bg-blue-500/5">
            <MessageCircle size={18} className="group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-[11px] font-black tracking-widest">{commentsCount}</span>
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowComments(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className={`relative w-full max-w-xl max-h-[80vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl ${theme.isDark ? 'bg-[#1a1a1a] text-white' : 'bg-white text-stone-900'}`}
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h3 className="font-black uppercase tracking-widest text-xs">Komentáře ({commentsCount})</h3>
                <button onClick={() => setShowComments(false)} className="opacity-40 hover:opacity-100 transition-opacity">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {loadingComments ? (
                  <div className="flex justify-center py-12">
                    <div className="w-6 h-6 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                  </div>
                ) : comments.length > 0 ? (
                  comments.map(comment => (
                    <div key={comment.id} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-stone-100 overflow-hidden flex-shrink-0">
                        {comment.user.image ? (
                          <img src={comment.user.image} alt={comment.user.name || ""} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-stone-200 text-stone-500 font-bold text-xs">
                            {comment.user.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-xs uppercase tracking-wider">{comment.user.name || "Anonym"}</span>
                          <span className="text-[10px] opacity-30 font-bold">{new Date(comment.createdAt).toLocaleDateString("cs-CZ")}</span>
                        </div>
                        <p className="text-sm opacity-70 leading-relaxed">{comment.content}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 opacity-30 italic text-sm">Zatím žádné komentáře. Buďte první!</div>
                )}
              </div>

              <div className="p-6 border-t border-white/10">
                {session ? (
                  <form onSubmit={handlePostComment} className="relative">
                    <textarea 
                      placeholder="Napište komentář..." 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className={`w-full bg-stone-100/10 border-0 rounded-2xl p-4 pr-12 text-sm focus:ring-2 focus:ring-current/20 transition-all resize-none ${theme.isDark ? 'placeholder-white/20' : 'placeholder-stone-400'}`}
                      rows={2}
                    />
                    <button 
                      disabled={submitting || !newComment.trim()}
                      className="absolute right-3 bottom-3 p-2 rounded-xl bg-current text-stone-900 disabled:opacity-20 hover:scale-105 active:scale-95 transition-all"
                    >
                      {submitting ? <div className="w-4 h-4 border-2 border-stone-900/20 border-t-stone-900 rounded-full animate-spin" /> : <Send size={16} />}
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-4">
                    <p className="text-xs font-bold opacity-40 uppercase tracking-widest text-center">Pro přidání komentáře se prosím přihlaste</p>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setShowAuthModal(true)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 bg-white text-black shadow-xl`}
                      >
                        <LogIn size={14} />
                        Přihlásit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showAuthModal && (
          <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] p-10 text-stone-900 shadow-2xl flex flex-col items-center text-center gap-8"
            >
              <div className="w-16 h-16 bg-[#ea580c]/10 rounded-3xl flex items-center justify-center text-[#ea580c]">
                 <UserPlus size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Připojte se k nám</h2>
                <p className="text-sm text-stone-500 font-medium leading-relaxed">
                  Questea je místo pro sdílení zážitků. Přihlaste se a buďte součástí naší komunity.
                </p>
              </div>
              <div className="w-full space-y-3">
                <button 
                  onClick={() => signIn(undefined, { callbackUrl: window.location.href })}
                  className="w-full py-4 rounded-2xl bg-black text-white font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-stone-900 transition-colors"
                >
                  Přihlásit se
                </button>
                <button 
                   onClick={() => window.location.href = '/register'}
                   className="w-full py-4 rounded-2xl bg-stone-100 text-stone-600 font-black uppercase tracking-widest text-[11px] hover:bg-stone-200 transition-colors"
                >
                   Vytvořit účet
                </button>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="text-[10px] font-bold uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity">
                Možná později
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
