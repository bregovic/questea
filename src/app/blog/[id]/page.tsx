import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MapPin, Clock, Navigation, Calendar, ChevronDown, Camera } from "lucide-react";
import { Reveal, RevealImage, FloatingHeader, BlogStyles, ViewCounter } from "@/components/Blog/BlogClient";
import { BlogContainer } from "@/components/Blog/BlogContainer";
import { headers } from "next/headers";

import { Metadata } from "next";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const folder = await prisma.task.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { title: true }
  });

  return {
    title: folder?.title || "Questea Blog",
    description: "Zápis z cesty",
    openGraph: {
      title: folder?.title || "Questea Blog",
      description: "Sdílený deník z Questea",
    }
  };
}

async function getBlogData(idOrSlug: string, userIp: string) {
  const folder = await prisma.task.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    },
    include: {
      subTasks: {
        where: { isDeleted: false, isPrivate: false },
        include: {
          locations: true,
          attachments: {
            select: {
              id: true,
              name: true,
              type: true,
              createdAt: true
              // url is excluded to save bandwidth, served via /api/images/[id]
            }
          },
          _count: {
            select: {
              likes: true,
              comments: true
            }
          },
          likes: {
            where: { ipAddress: userIp },
            take: 1
          }
        },
        orderBy: { recordedAt: "asc" }
      },
      // Kolekce: příspěvky přidané do tohoto blogu napříč timeline (bez přesunu v hierarchii).
      collectionItems: {
        where: { post: { isDeleted: false, isPrivate: false } },
        include: {
          post: {
            include: {
              locations: true,
              attachments: {
                select: { id: true, name: true, type: true, createdAt: true }
              },
              _count: { select: { likes: true, comments: true } },
              likes: { where: { ipAddress: userIp }, take: 1 }
            }
          }
        }
      }
    }
  });

  if (!folder) return null;

  // Sloučení: pod-úkoly (hierarchie) + příspěvky z kolekce; dedup dle id; řazení dle času.
  const memberPosts = folder.collectionItems.map((ci) => ci.post);
  const byId = new Map<string, any>();
  for (const p of [...folder.subTasks, ...memberPosts]) byId.set(p.id, p);
  const merged = [...byId.values()].sort((a, b) => {
    const ta = new Date(a.recordedAt || a.createdAt).getTime();
    const tb = new Date(b.recordedAt || b.createdAt).getTime();
    return ta - tb;
  });

  return { ...folder, subTasks: merged };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default async function BlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headerList = await headers();
  const userIp = headerList.get("x-forwarded-for")?.split(",")[0] || "0.0.0.0";

  const folder = await getBlogData(id, userIp);
  if (!folder) notFound();

  const posts = folder.subTasks.map((post: any) => ({
    ...post,
    attachments: post.attachments.map((att: any) => ({
      ...att,
      url: att.type === 'image' ? `/api/images/${att.id}` : '#'
    }))
  }));
  const template = folder.blogTemplate || "MODERN";

  // Calculate Total KM using DB values where possible
  let totalKm = 0;
  posts.forEach((p, i) => {
    if (p.calculatedDistance !== null && p.calculatedDistance !== undefined) {
      totalKm += p.calculatedDistance;
    } else if (i < posts.length - 1) {
      // Fallback for non-calculated segments
      const l1 = p.locations?.[0];
      const l2 = posts[i+1].locations?.[0];
      if (l1 && l2) totalKm += calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
    }
  });

  const startDate = posts.length > 0 ? new Date(posts[0].recordedAt || posts[0].createdAt).toLocaleDateString("cs-CZ") : "";
  const endDate = posts.length > 0 ? new Date(posts[posts.length-1].recordedAt || posts[posts.length-1].createdAt).toLocaleDateString("cs-CZ") : "";

  const isMinimal = template === "MINIMAL";
  const isAdventure = template === "ADVENTURE";
  const isElegant = template === "ELEGANT";
  const isDark = template === "DARK";

  const themeClass = isDark 
    ? 'bg-[#0a0a0a] font-["Outfit",sans-serif] text-white selection:bg-white selection:text-black' 
    : isAdventure 
    ? 'bg-[#f4f1ea] font-serif text-[#4a3728] selection:bg-[#4a3728] selection:text-white' 
    : isElegant
    ? 'bg-[#fafafa] font-serif text-[#1a1a1a] selection:bg-[#c5a059] selection:text-white'
    : isMinimal 
    ? 'bg-white font-sans text-black selection:bg-black selection:text-white' 
    : 'bg-[#fafaf9] font-["Outfit",sans-serif] text-[#1c1917] selection:bg-[#ea580c] selection:text-white';

  return (
    <div className={`min-h-screen pb-40 ${themeClass}`}>
      
      <BlogStyles />

      {/* Hero Section */}
      {!isMinimal ? (
        <header className={`relative h-[90vh] flex items-center justify-center overflow-hidden ${isDark ? 'bg-black' : isAdventure ? 'bg-[#2d241e]' : isElegant ? 'bg-[#1a1a1a]' : 'bg-[#0c0a09]'}`}>
          <div className={`absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent ${isDark ? 'to-[#0a0a0a]' : 'to-current/20 opacity-40'}`} />
          
          <FloatingHeader>
            <div className={`absolute inset-0 opacity-40 z-0 scale-110 ${isAdventure ? "bg-[url('https://www.transparenttextures.com/patterns/black-paper.png')]" : "bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"}`} />
          </FloatingHeader>
          
          <div className="relative z-20 text-center px-6 max-w-5xl">
            <Reveal delay={0.4}>
              <h1 className={`text-6xl md:text-[140px] font-black text-white mb-12 tracking-tighter leading-[0.75] drop-shadow-2xl ${isAdventure || isElegant ? 'font-serif italic' : ''}`}>
                {folder.title}
              </h1>
            </Reveal>

            <Reveal delay={0.6}>
              <div className="flex flex-col items-center gap-10">
                {posts.length > 0 && (
                  <div className="flex flex-col items-center gap-4">
                    <div className={`flex items-center gap-3 px-6 py-2.5 rounded-full border border-white/10 backdrop-blur-md bg-white/5 text-white/90 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl`}>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Aktuální poloha
                    </div>
                    
                    {posts[posts.length - 1].locations?.[0] && (
                      <div className="flex flex-col items-center gap-4 group">
                         <div className="h-32 w-48 rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl relative">
                            <BlogContainer 
                               posts={posts} 
                               folder={folder} 
                               template={template} 
                               onlyMap={posts[posts.length - 1]} 
                            />
                         </div>
                         <div className="text-center">
                             <div className="text-white font-black text-sm mb-1 uppercase tracking-wider">
                                {posts[posts.length - 1].title || "Na cestě"}
                             </div>
                            <div className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">
                               {new Date(posts[posts.length - 1].recordedAt || posts[posts.length - 1].createdAt).toLocaleString("cs-CZ", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                         </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-16 text-white/40 font-black uppercase text-[11px] tracking-[0.3em]">
                  <div className="flex items-center gap-4">
                    <Calendar size={18} className={isAdventure ? 'text-[#d4a373]' : isElegant ? 'text-[#c5a059]' : 'text-[#ea580c]'} />
                    <span>{startDate} {startDate !== endDate && `— ${endDate}`}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Navigation size={18} className={isAdventure ? 'text-[#d4a373]' : isElegant ? 'text-[#c5a059]' : 'text-[#ea580c]'} />
                    <span>{totalKm.toFixed(1)} KM</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-4 opacity-30">
             <ChevronDown className="text-white animate-bounce" size={24} />
          </div>
        </header>
      ) : (
        <header className="max-w-4xl mx-auto px-6 pt-40 pb-24 text-center">
           <Reveal>
             <h1 className="text-8xl md:text-9xl font-light tracking-tighter mb-12">{folder.title}</h1>
             <div className="flex justify-center gap-16 text-stone-400 text-xs font-black tracking-widest uppercase">
               <span>{startDate} — {endDate}</span>
               <span>{totalKm.toFixed(1)} KM</span>
             </div>
           </Reveal>
        </header>
      )}

      {/* Main Content */}
      <main className={`max-w-4xl mx-auto px-6 relative z-30 ${isMinimal ? 'pt-24' : 'pt-20 md:pt-32'}`}>
        <BlogContainer posts={posts} folder={folder} template={template} />
      </main>

      <footer className="mt-80 pb-60 text-center flex flex-col items-center gap-12">
         <div className={`h-2 w-32 mx-auto ${isAdventure ? 'bg-[#d4a373]' : isElegant ? 'bg-[#c5a059]' : isDark ? 'bg-white' : 'bg-[#ea580c]'}`} />
         <ViewCounter blogId={folder.slug || folder.id} />
      </footer>
    </div>
  );
}
