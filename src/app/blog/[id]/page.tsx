import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MapPin, Clock, Navigation, Calendar, ChevronDown, Quote } from "lucide-react";
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

  return (
    <div className={`min-h-screen pb-40 selection:bg-[#ea580c] selection:text-white ${isAdventure ? 'bg-[#f4f1ea] font-serif text-[#4a3728]' : isMinimal ? 'bg-white font-sans text-black' : 'bg-[#fafaf9] font-sans text-[#1c1917]'}`}>
      
      {/* Hero Section */}
      {!isMinimal ? (
        <header className={`relative h-[90vh] flex items-center justify-center overflow-hidden ${isAdventure ? 'bg-[#2d241e]' : 'bg-[#0c0a09]'}`}>
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-black/70" />
          
          <FloatingHeader>
            <div className="absolute inset-0 opacity-40 z-0 scale-110 bg-[url('https://www.transparenttextures.com/patterns/black-paper.png')]" />
          </FloatingHeader>
          
          <div className="relative z-20 text-center px-6 max-w-5xl">
            <Reveal delay={0.2}>
              <div className="mb-8 inline-block">
                <div className={`backdrop-blur-xl px-6 py-2 rounded-full border text-[11px] font-black uppercase tracking-[0.4em] ${isAdventure ? 'bg-[#d4a373]/20 border-[#d4a373]/30 text-[#d4a373]' : 'bg-[#ea580c]/20 border-[#ea580c]/30 text-[#ea580c]'}`}>
                  {isAdventure ? 'Expedition Journal' : 'The Travel Log'}
                </div>
              </div>
            </Reveal>
            
            <Reveal delay={0.4}>
              <h1 className={`text-6xl md:text-[140px] font-black text-white mb-10 tracking-tighter leading-[0.8] drop-shadow-2xl ${isAdventure ? 'font-serif italic' : ''}`}>
                {folder.title}
              </h1>
            </Reveal>

            <Reveal delay={0.6}>
              <div className="flex flex-wrap justify-center gap-12 text-white/50 font-bold uppercase text-[11px] tracking-[0.2em]">
                <div className="flex items-center gap-3">
                  <Calendar size={16} className={isAdventure ? 'text-[#d4a373]' : 'text-[#ea580c]'} />
                  <span>{startDate} {startDate !== endDate && `— ${endDate}`}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Navigation size={16} className={isAdventure ? 'text-[#d4a373]' : 'text-[#ea580c]'} />
                  <span>{totalKm.toFixed(1)} Kilometers</span>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-4 opacity-40">
             <span className="text-white text-[10px] font-black tracking-widest uppercase">Scroll Down</span>
             <ChevronDown className="text-white animate-bounce" size={24} />
          </div>
        </header>
      ) : (
        <header className="max-w-4xl mx-auto px-6 pt-40 pb-24 text-center">
           <Reveal>
             <span className="text-[10px] font-black tracking-[0.5em] uppercase text-stone-300 mb-6 block">Archive Log</span>
             <h1 className="text-7xl md:text-8xl font-light tracking-tighter mb-10">{folder.title}</h1>
             <div className="flex justify-center gap-12 text-stone-400 text-xs font-bold tracking-widest uppercase">
               <span>{startDate} — {endDate}</span>
               <span>{totalKm.toFixed(1)} KM</span>
             </div>
           </Reveal>
        </header>
      )}

      {/* Main Content */}
      <main className={`max-w-4xl mx-auto px-6 relative z-30 ${!isMinimal ? '-mt-24' : 'pt-20'}`}>
        <div className="space-y-48">
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

            return (
              <article key={post.id} className="relative group">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
                  
                  {/* Left Metadata */}
                  {!isMinimal && (
                    <div className="md:col-span-2 hidden md:block pt-4 sticky top-12">
                       <Reveal>
                         <div className={`text-[11px] font-black uppercase tracking-widest mb-4 ${isAdventure ? 'text-[#a68a64]' : 'text-[#ea580c]'}`}>
                            Day {idx + 1}
                         </div>
                         <div className="text-stone-400 text-[10px] font-bold space-y-1">
                            <div className="flex items-center gap-2"><Clock size={12}/> {date.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}</div>
                            <div>{date.toLocaleDateString("cs-CZ")}</div>
                         </div>
                       </Reveal>
                    </div>
                  )}

                  {/* Main Content Body */}
                  <div className={`${isMinimal ? 'md:col-span-12' : 'md:col-span-10'}`}>
                    
                    <header className="mb-12">
                       <Reveal>
                         <h2 className={`text-4xl md:text-7xl font-black leading-[0.9] mb-6 ${isAdventure ? 'font-serif italic text-[#2d241e]' : 'tracking-tighter text-[#1c1917]'}`}>
                            {post.title}
                         </h2>
                         {post.locations?.[0] && !isMinimal && (
                           <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase tracking-widest">
                             <MapPin size={14} className={isAdventure ? 'text-[#a68a64]' : 'text-[#ea580c]'} />
                             {post.locations[0].placeName || post.locations[0].address}
                           </div>
                         )}
                       </Reveal>
                    </header>

                    <div className="flex flex-col gap-16">
                       {/* Photos with Magazine Grid & Reveal */}
                       {images.length > 0 && (
                         <div className={`grid gap-8 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
                            {images.map((att: any, imgIdx: number) => {
                               const rotation = isAdventure ? (imgIdx % 2 === 0 ? -2 : 2) : 0;
                               const span = (imgIdx === 0 && images.length > 2) ? 'md:col-span-2 md:row-span-2' : '';
                               
                               return (
                                 <RevealImage 
                                   key={att.id} 
                                   delay={imgIdx * 0.1} 
                                   rotation={rotation}
                                 >
                                   <div className={`relative group overflow-hidden shadow-2xl transition-all duration-1000 ${span} ${isAdventure ? 'border-[12px] border-white p-1 rounded-sm shadow-stone-400/30' : 'rounded-[40px]'}`}>
                                     {isAdventure && (
                                       <div className="absolute top-[-15px] left-1/2 -translate-x-1/2 w-24 h-10 bg-white/50 backdrop-blur-sm z-20 rotate-[-2deg] shadow-sm pointer-events-none" />
                                     )}
                                     <img 
                                       src={att.url} 
                                       alt={att.name} 
                                       className={`w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 ${span ? 'aspect-auto h-full min-h-[400px]' : 'aspect-[4/3]'}`} 
                                     />
                                   </div>
                                 </RevealImage>
                               );
                            })}
                         </div>
                       )}

                       {/* Diary Story with Reveal */}
                       {post.description && (
                         <Reveal delay={0.2}>
                           <div className={`relative ${isAdventure ? 'font-serif text-[#4a3728] leading-relaxed text-2xl max-w-2xl' : 'text-stone-600 leading-[1.8] text-xl md:text-2xl max-w-3xl'}`}>
                              <span className={`float-left text-7xl md:text-9xl font-black mr-4 mt-2 line-height-1 leading-[0.7] ${isAdventure ? 'text-[#d4a373]' : 'text-[#ea580c]/20'}`}>
                                 {post.description.charAt(0)}
                              </span>
                              <p className="whitespace-pre-wrap">
                                 {post.description.slice(1)}
                              </p>
                              
                              {isAdventure && (
                                <div className="absolute -bottom-12 -right-12 opacity-5 pointer-events-none">
                                   <Quote size={160} />
                                </div>
                              )}
                           </div>
                         </Reveal>
                       )}
                    </div>
                  </div>
                </div>

                {/* Next Stage Indicator */}
                {distToNext > 0.1 && (
                  <Reveal>
                    <div className="flex items-center gap-12 my-24">
                      <div className={`h-px flex-1 opacity-10 ${isAdventure ? 'bg-[#4a3728]' : 'bg-black'}`} />
                      <div className={`text-[10px] font-black tracking-[0.5em] uppercase whitespace-nowrap opacity-30 flex items-center gap-4 ${isAdventure ? 'font-serif italic' : ''}`}>
                         <Navigation size={12} />
                         Next Stage: {distToNext.toFixed(1)} KM
                      </div>
                      <div className={`h-px flex-1 opacity-10 ${isAdventure ? 'bg-[#4a3728]' : 'bg-black'}`} />
                    </div>
                  </Reveal>
                )}
              </article>
            );
          })}
        </div>
      </main>

      <footer className="mt-60 pb-40 text-center">
         <Reveal>
           <div className="max-w-xs mx-auto mb-20">
              <div className={`h-1.5 w-24 mx-auto mb-10 ${isAdventure ? 'bg-[#d4a373]' : 'bg-[#ea580c]'}`} />
              <p className="text-sm font-light italic opacity-50 mb-16 leading-relaxed">
                Life is an adventure meant to be shared. Captured with Questea.
              </p>
           </div>
           <div className="flex flex-col items-center gap-8">
              <div className="text-[10px] font-black tracking-[1.5em] uppercase opacity-20">The Journey Ends</div>
              <div className={`w-12 h-12 rounded-full border flex items-center justify-center opacity-30 ${isAdventure ? 'border-[#4a3728]' : 'border-black'}`}>
                 <Camera size={16} />
              </div>
           </div>
         </Reveal>
      </footer>

      <BlogStyles />
    </div>
  );
}
