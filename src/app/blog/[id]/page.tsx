import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MapPin, Clock, Navigation, Calendar, ChevronDown, Camera } from "lucide-react";
import { Reveal, RevealImage, FloatingHeader, BlogStyles } from "@/components/Blog/BlogClient";

export const dynamic = "force-dynamic";

async function getBlogData(idOrSlug: string) {
  const folder = await prisma.task.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    },
    include: {
      subTasks: {
        where: { isDeleted: false },
        include: {
          locations: true,
          attachments: true
        },
        orderBy: { recordedAt: "asc" }
      }
    }
  });

  if (!folder) return null;
  return folder;
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
  const folder = await getBlogData(id);
  if (!folder) notFound();

  const posts = folder.subTasks;
  const template = folder.blogTemplate || "MODERN";

  let totalKm = 0;
  for (let i = 0; i < posts.length - 1; i++) {
    const l1 = posts[i].locations?.[0];
    const l2 = posts[i+1].locations?.[0];
    if (l1 && l2) {
      totalKm += calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
    }
  }

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
            <Reveal delay={0.2}>
              <div className="mb-10 inline-block">
                <div className={`backdrop-blur-2xl px-8 py-2.5 rounded-full border border-white/10 text-[12px] font-black uppercase tracking-[0.5em] ${isAdventure ? 'bg-[#d4a373]/20 text-[#d4a373]' : isElegant ? 'bg-[#c5a059]/20 text-[#c5a059]' : 'bg-[#ea580c]/20 text-[#ea580c]'}`}>
                  {isAdventure ? 'Diary' : isElegant ? 'Collection' : 'Voyage'}
                </div>
              </div>
            </Reveal>
            
            <Reveal delay={0.4}>
              <h1 className={`text-6xl md:text-[140px] font-black text-white mb-12 tracking-tighter leading-[0.75] drop-shadow-2xl ${isAdventure || isElegant ? 'font-serif italic' : ''}`}>
                {folder.title}
              </h1>
            </Reveal>

            <Reveal delay={0.6}>
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
        <div className="space-y-64">
          {posts.map((post, idx) => {
            const date = new Date(post.recordedAt || post.createdAt);
            const nextPost = posts[idx + 1];
            const images = post.attachments?.filter((a:any) => a.type === 'image') || [];
            
            let distToNext = 0;
            if (nextPost) {
              const l1 = post.locations?.[0];
              const l2 = nextPost.locations?.[0];
              if (l1 && l2) distToNext = calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
            }

            // Interweaving logic: decide layout based on photo count and text length
            const hasLongText = (post.description?.length || 0) > 200;
            const useSideBySide = images.length === 1 && hasLongText && !isMinimal;

            return (
              <article key={post.id} className="relative group">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-16 items-start">
                  
                  {/* Metadata Column (Desktop) */}
                  {!isMinimal && (
                    <div className="md:col-span-2 hidden md:block pt-6 sticky top-16">
                       <Reveal>
                         <div className={`text-[12px] font-black uppercase tracking-[0.3em] mb-6 ${isAdventure ? 'text-[#a68a64]' : isElegant ? 'text-[#c5a059]' : isDark ? 'text-white/40' : 'text-[#ea580c]'}`}>
                            {idx + 1}
                         </div>
                         <div className={`text-[11px] font-black space-y-2 opacity-60 ${isDark ? 'text-white/30' : 'text-stone-400'}`}>
                            <div>{date.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}</div>
                            <div>{date.toLocaleDateString("cs-CZ")}</div>
                         </div>
                       </Reveal>
                    </div>
                  )}

                  {/* Main Entry Content */}
                  <div className={`${isMinimal ? 'md:col-span-12' : 'md:col-span-10'}`}>
                    
                    <header className="mb-16">
                       <Reveal>
                         <h2 className={`text-5xl md:text-8xl font-black leading-[0.85] mb-10 ${isAdventure || isElegant ? 'font-serif italic' : 'tracking-tighter'}`}>
                            {post.title}
                         </h2>
                         {post.locations?.[0] && !isMinimal && (
                           <div className={`flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] ${isDark ? 'text-white/40' : 'text-stone-400'}`}>
                             <MapPin size={16} className={isAdventure ? 'text-[#a68a64]' : isElegant ? 'text-[#c5a059]' : 'text-[#ea580c]'} />
                             {post.locations[0].placeName || post.locations[0].address}
                           </div>
                         )}
                       </Reveal>
                    </header>

                    <div className="flex flex-col gap-12">
                       {/* Interwoven Layout: Image and Text Side by Side if possible */}
                       {useSideBySide ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                            <RevealImage delay={0.1}>
                               <div className={`relative overflow-hidden shadow-xl ${isAdventure ? 'border-[12px] border-white p-1' : isElegant ? 'rounded-none border border-stone-200' : 'rounded-2xl md:rounded-3xl'}`}>
                                 <img src={images[0].url} alt={images[0].name} className="w-full object-cover aspect-[4/5]" />
                               </div>
                            </RevealImage>
                            <Reveal delay={0.2}>
                               <div className={`relative ${isAdventure || isElegant ? 'font-serif leading-relaxed text-2xl' : 'leading-[1.8] text-xl md:text-2xl'}`}>
                                  <span className={`drop-cap ${isAdventure ? 'text-[#d4a373]' : isElegant ? 'text-[#c5a059]' : 'text-[#ea580c]/30'}`}>
                                     {post.description!.charAt(0)}
                                  </span>
                                  <p className="whitespace-pre-wrap">{post.description!.slice(1)}</p>
                               </div>
                            </Reveal>
                         </div>
                       ) : (
                         <>
                           {/* Normal Flow: Big Images first, then Text */}
                           {images.length > 0 && (
                             <div className={`grid gap-6 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                                {images.map((att: any, imgIdx: number) => {
                                   const rotation = isAdventure ? (imgIdx % 2 === 0 ? -2.5 : 2.5) : 0;
                                   const span = (imgIdx === 0 && images.length > 2) ? 'md:col-span-2 md:row-span-2' : '';
                                   
                                   return (
                                     <RevealImage 
                                       key={att.id} 
                                       delay={imgIdx * 0.1} 
                                       rotation={rotation}
                                     >
                                       <div className={`relative group overflow-hidden shadow-xl transition-all duration-1000 ${span} ${isAdventure ? 'border-[12px] border-white p-1 rounded-sm shadow-stone-400/30' : isElegant ? 'rounded-none border border-stone-100' : 'rounded-2xl md:rounded-3xl'}`}>
                                         {isAdventure && (
                                           <div className="absolute top-[-15px] left-1/2 -translate-x-1/2 w-24 h-10 washi-tape z-20 rotate-[-2deg] pointer-events-none opacity-80" />
                                         )}
                                         <img 
                                           src={att.url} 
                                           alt={att.name} 
                                           className={`w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 ${span ? 'aspect-auto h-full min-h-[500px]' : 'aspect-[4/3]'}`} 
                                         />
                                       </div>
                                     </RevealImage>
                                   );
                                })}
                             </div>
                           )}

                           {post.description && (
                             <Reveal delay={0.2}>
                               <div className={`relative ${isAdventure || isElegant ? 'font-serif leading-relaxed text-2xl max-w-2xl' : 'text-stone-600 leading-[1.8] text-xl md:text-2xl max-w-3xl'}`}>
                                  <span className={`drop-cap ${isAdventure ? 'text-[#d4a373]' : isElegant ? 'text-[#c5a059]' : isDark ? 'text-white/20' : 'text-[#ea580c]/30'}`}>
                                     {post.description.charAt(0)}
                                  </span>
                                  <p className="whitespace-pre-wrap">{post.description.slice(1)}</p>
                               </div>
                             </Reveal>
                           )}
                         </>
                       )}
                    </div>
                  </div>
                </div>

                {/* Distance Indicator */}
                {distToNext > 0.1 && (
                  <Reveal>
                    <div className="flex items-center gap-16 my-32">
                      <div className={`h-px flex-1 opacity-10 ${isDark ? 'bg-white' : 'bg-black'}`} />
                      <div className={`text-[11px] font-black tracking-[0.6em] uppercase whitespace-nowrap opacity-20 flex items-center gap-6 ${isAdventure || isElegant ? 'font-serif italic' : ''}`}>
                         <Navigation size={14} />
                         {distToNext.toFixed(1)} KM
                      </div>
                      <div className={`h-px flex-1 opacity-10 ${isDark ? 'bg-white' : 'bg-black'}`} />
                    </div>
                  </Reveal>
                )}
              </article>
            );
          })}
        </div>
      </main>

      <footer className="mt-80 pb-60 text-center opacity-30">
         <div className={`h-2 w-32 mx-auto ${isAdventure ? 'bg-[#d4a373]' : isElegant ? 'bg-[#c5a059]' : isDark ? 'bg-white' : 'bg-[#ea580c]'}`} />
      </footer>
    </div>
  );
}
