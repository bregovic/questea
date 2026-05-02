import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MapPin, Clock, Navigation, Calendar, Camera, ChevronDown } from "lucide-react";

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

  // Template Styles
  const isMinimal = template === "MINIMAL";
  const isAdventure = template === "ADVENTURE";

  return (
    <div className={`min-h-screen pb-20 ${isAdventure ? 'bg-[#f4f1ea] font-serif text-[#4a3728]' : isMinimal ? 'bg-white font-sans text-black' : 'bg-[#fafaf9] font-sans text-[#1c1917]'}`}>
      
      {/* Hero Header */}
      {!isMinimal ? (
        <header className={`relative h-[65vh] flex items-end justify-center overflow-hidden ${isAdventure ? 'bg-[#2d241e]' : 'bg-[#1c1917]'}`}>
          <div className="absolute inset-0 opacity-50 bg-gradient-to-t from-current to-transparent z-10" />
          <div className="absolute inset-0 opacity-20 z-0 bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]" />
          
          <div className="relative z-20 text-center px-6 pb-20 max-w-4xl">
            <div className="flex justify-center mb-6">
               <div className={`backdrop-blur-md px-4 py-1 rounded-full border text-xs font-bold uppercase tracking-[0.2em] ${isAdventure ? 'bg-[#d4a373]/20 border-[#d4a373]/30 text-[#d4a373]' : 'bg-[#ea580c]/20 border-[#ea580c]/30 text-[#ea580c]'}`}>
                 {isAdventure ? 'Expediční Záznam' : 'Cestovní Deník'}
               </div>
            </div>
            <h1 className={`text-5xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-[0.9] ${isAdventure ? 'italic font-serif' : ''}`}>
              {folder.title}
            </h1>
            <div className="flex flex-wrap justify-center gap-8 text-white/70 font-semibold uppercase text-[10px] tracking-widest">
              <div className="flex items-center gap-2">
                <Calendar size={14} className={isAdventure ? 'text-[#d4a373]' : 'text-[#ea580c]'} />
                <span>{startDate} {startDate !== endDate && `— ${endDate}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <Navigation size={14} className={isAdventure ? 'text-[#d4a373]' : 'text-[#ea580c]'} />
                <span>{totalKm.toFixed(1)} KM</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 animate-bounce opacity-30">
            <ChevronDown className="text-white" size={32} />
          </div>
        </header>
      ) : (
        <header className="max-w-4xl mx-auto px-6 pt-32 pb-20 text-center border-b border-stone-100">
           <h1 className="text-6xl font-light tracking-tight mb-8">{folder.title}</h1>
           <div className="flex justify-center gap-10 text-stone-400 text-sm font-medium">
             <span>{startDate} — {endDate}</span>
             <span>{totalKm.toFixed(1)} km</span>
           </div>
        </header>
      )}

      {/* Content Timeline */}
      <main className={`max-w-3xl mx-auto px-6 relative z-30 ${!isMinimal ? '-mt-12' : 'pt-20'}`}>
        <div className="space-y-24">
          {posts.map((post, idx) => {
            const date = new Date(post.recordedAt || post.createdAt);
            const nextPost = posts[idx + 1];
            let distToNext = 0;
            if (nextPost) {
              const l1 = post.locations?.[0];
              const l2 = nextPost.locations?.[0];
              if (l1 && l2) distToNext = calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
            }

            return (
              <article key={post.id} className="relative">
                {/* Timeline line for non-minimal */}
                {!isMinimal && idx < posts.length - 1 && (
                  <div className={`absolute left-[24px] top-[60px] bottom-[-96px] w-[2px] opacity-10 hidden md:block ${isAdventure ? 'bg-[#4a3728]' : 'bg-[#ea580c]'}`} />
                )}

                <div className={`transition-all duration-500 ${isMinimal ? '' : 'bg-white rounded-[40px] p-8 md:p-12 shadow-2xl shadow-stone-200/40 border border-stone-100'} ${isAdventure ? '!bg-[#fffdfa] !border-[#e2dcc8] !rounded-sm !shadow-none rotate-[-0.5deg]' : ''}`}>
                  <header className="mb-10">
                    <div className="flex items-center gap-5 mb-6">
                      {!isMinimal && (
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl ${isAdventure ? 'bg-[#4a3728] rounded-full' : 'bg-[#ea580c] shadow-[#ea580c]/20'}`}>
                          <MapPin size={28} />
                        </div>
                      )}
                      <div>
                        <div className={`flex items-center gap-3 font-bold text-xs mb-2 tracking-widest uppercase ${isAdventure ? 'text-[#a68a64]' : isMinimal ? 'text-stone-400' : 'text-[#ea580c]'}`}>
                          <Clock size={14} />
                          <span>{date.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="opacity-30">•</span>
                          <span>{date.toLocaleDateString("cs-CZ")}</span>
                        </div>
                        <h2 className={`text-3xl md:text-5xl font-black leading-tight ${isAdventure ? 'font-serif italic text-[#2d241e]' : 'tracking-tighter text-[#1c1917]'}`}>
                          {post.title}
                        </h2>
                      </div>
                    </div>
                    {post.locations?.[0] && (
                      <p className="text-stone-400 text-sm font-medium flex items-center gap-2 ml-1">
                        <Navigation size={14} />
                        {post.locations[0].address}
                      </p>
                    )}
                  </header>

                  {/* Photos Grid */}
                  {post.attachments?.length > 0 && (
                    <div className={`grid gap-4 mb-10 ${post.attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {post.attachments.filter((a:any) => a.type === 'image').map((att: any) => (
                        <div key={att.id} className={`overflow-hidden shadow-lg ${isAdventure ? 'border-8 border-white rounded-none rotate-2 shadow-stone-400/20' : 'rounded-[24px]'}`}>
                          <img 
                            src={att.url} 
                            alt={att.name} 
                            className="w-full h-full object-cover aspect-[4/3] transition-transform duration-1000 hover:scale-110" 
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Story */}
                  {post.description && (
                    <div className={`max-w-none ${isAdventure ? 'font-serif text-[#4a3728] leading-relaxed text-xl' : 'text-stone-600 leading-loose text-lg'}`}>
                      <p className={isMinimal ? 'font-serif italic border-l-2 border-black pl-8' : ''}>
                        {post.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Distance Connector */}
                {distToNext > 0.1 && (
                  <div className="flex justify-center my-12">
                    <div className={`text-[10px] font-black tracking-[0.2em] uppercase px-6 py-2 rounded-full flex items-center gap-3 ${isAdventure ? 'bg-[#e2dcc8]/30 text-[#a68a64] border border-[#e2dcc8]/50' : isMinimal ? 'bg-stone-50 text-stone-300' : 'bg-[#f0fdf4] text-[#16a34a] border border-[#dcfce7]'}`}>
                      <Navigation size={12} />
                      {distToNext.toFixed(1)} km k dalšímu cíli
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </main>

      <footer className="mt-40 pb-20 text-center">
        <div className={`h-px max-w-xs mx-auto mb-10 opacity-10 ${isAdventure ? 'bg-[#4a3728]' : 'bg-black'}`} />
        <p className={`text-xs font-bold uppercase tracking-widest opacity-30 ${isAdventure ? 'font-serif italic' : ''}`}>
          © {new Date().getFullYear()} Questea Blog Engine
        </p>
      </footer>
    </div>
  );
}
