import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MapPin, Clock, Navigation, Calendar, ChevronDown, Camera } from "lucide-react";
import { Reveal, RevealImage, FloatingHeader, BlogStyles } from "@/components/Blog/BlogClient";
import { BlogContainer } from "@/components/Blog/BlogContainer";

export const revalidate = 60;

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
                  {isAdventure ? 'Deník' : isElegant ? 'Kolekce' : 'Expedice'}
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
        <BlogContainer posts={posts} folder={folder} template={template} />
      </main>

      <footer className="mt-80 pb-60 text-center opacity-30">
         <div className={`h-2 w-32 mx-auto ${isAdventure ? 'bg-[#d4a373]' : isElegant ? 'bg-[#c5a059]' : isDark ? 'bg-white' : 'bg-[#ea580c]'}`} />
      </footer>
    </div>
  );
}
