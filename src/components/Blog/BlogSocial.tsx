"use client";

import React, { useState, useEffect } from "react";
import { Heart, MessageCircle, Send, X, LogIn, UserPlus, User } from "lucide-react";
import { useSession, signIn } from "next-auth/react";
import { Reveal } from "./BlogClient";
import { AnimatePresence, motion } from "framer-motion";

interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
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
    const prevLiked = liked;
    setLiked(!prevLiked);
    setLikesCount(prevLiked ? likesCount - 1 : likesCount + 1);

    try {
      const res = await fetch(`/api/blog/posts/${taskId}/like`, { method: "POST" });
      const data = await res.json();
      if (data.liked !== undefined) setLiked(data.liked);
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
    if (showComments) fetchComments();
  }, [showComments]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const getUserName = (comment: PostComment) => {
    if (!comment.user) return "Anonym";
    if (comment.user.name) return comment.user.name;
    if (comment.user.email) return comment.user.email.split('@')[0];
    return "Uživatel";
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowComments(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
              className={`relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-[32px] overflow-hidden shadow-2xl ${theme.isDark ? 'bg-[#1a1a1a] text-white border border-white/5' : 'bg-white text-stone-900 border border-stone-100'}`}
            >
              <div className="flex items-center justify-between p-6 px-8 border-b border-white/5 bg-white/5">
                <h3 className="font-black uppercase tracking-[0.2em] text-[10px] opacity-50">Diskuze ({commentsCount})</h3>
                <button onClick={() => setShowComments(false)} className="opacity-40 hover:opacity-100 transition-opacity p-2">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                {loadingComments ? (
                  <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-2 border-current/10 border-t-current rounded-full animate-spin" />
                  </div>
                ) : comments.length > 0 ? (
                  comments.map(comment => (
                    <div key={comment.id} className="flex gap-5 group">
                      <div className={`w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm border border-black/5 ${theme.isDark ? 'bg-white/5' : 'bg-stone-50'}`}>
                        {comment.user?.image ? (
                          <img src={comment.user.image} alt={getUserName(comment)} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-40">
                            <User size={20} />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-[11px] uppercase tracking-widest opacity-80">{getUserName(comment)}</span>
                          <span className="text-[9px] opacity-30 font-black tracking-widest uppercase">{new Date(comment.createdAt).toLocaleDateString("cs-CZ")}</span>
                        </div>
                        <p className="text-[15px] opacity-70 leading-relaxed font-medium">{comment.content}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20">
                     <div className="opacity-10 mb-4 flex justify-center"><MessageCircle size={40} /></div>
                     <p className="opacity-30 italic text-sm font-medium">Zatím žádné komentáře. Buďte první!</p>
                  </div>
                )}
              </div>

              <div className={`p-8 border-t border-white/5 ${theme.isDark ? 'bg-white/[0.02]' : 'bg-stone-50/50'}`}>
                <form onSubmit={handlePostComment} className="flex flex-col gap-4">
                  <div className="relative group">
                    <textarea 
                      placeholder={session ? "Napište něco..." : "Napište anonymní komentář..."}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className={`w-full bg-stone-100/10 border-2 border-transparent rounded-2xl p-5 pr-12 text-[15px] font-medium focus:border-current/10 focus:bg-stone-100/20 transition-all outline-none resize-none ${theme.isDark ? 'placeholder-white/20' : 'placeholder-stone-400'}`}
                      rows={2}
                    />
                    {!session && (
                      <button 
                        type="button"
                        onClick={() => setShowAuthModal(true)}
                        className="absolute right-4 top-4 opacity-30 hover:opacity-100 transition-opacity"
                        title="Přihlásit se pro jméno a fotku"
                      >
                        <LogIn size={18} />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between px-1">
                     {!session && (
                       <span className="text-[10px] font-black uppercase tracking-widest opacity-20">Píšete jako anonym</span>
                     )}
                     <div className="flex-1" />
                     <button 
                        disabled={submitting || !newComment.trim()}
                        className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:scale-100 ${theme.isDark ? 'bg-white text-black' : 'bg-stone-900 text-white shadow-xl shadow-stone-200'}`}
                      >
                        {submitting ? (
                          <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                        ) : (
                          <>
                            Odeslat
                            <Send size={14} />
                          </>
                        )}
                      </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {showAuthModal && (
          <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] p-10 text-stone-900 shadow-2xl flex flex-col items-center text-center gap-8"
            >
              <div className="w-16 h-16 bg-[#ea580c]/10 rounded-3xl flex items-center justify-center text-[#ea580c]">
                 <LogIn size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Přihlásit se</h2>
                <p className="text-sm text-stone-500 font-medium leading-relaxed">
                  Chcete u komentáře zobrazit své jméno a fotku? Přihlaste se ke svému Questea účtu.
                </p>
              </div>
              <div className="w-full space-y-3">
                <button 
                  onClick={() => signIn(undefined, { callbackUrl: window.location.href })}
                  className="w-full py-4 rounded-2xl bg-black text-white font-black uppercase tracking-widest text-[11px] shadow-2xl hover:bg-stone-900 transition-colors"
                >
                  Přihlásit se
                </button>
                <div className="py-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-20">Nebo pokračujte anonymně</div>
                <button 
                   onClick={() => setShowAuthModal(false)}
                   className="w-full py-4 rounded-2xl bg-stone-100 text-stone-600 font-black uppercase tracking-widest text-[11px] hover:bg-stone-200 transition-colors"
                >
                   Psát jako anonym
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
