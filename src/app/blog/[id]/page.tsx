import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MapPin, Clock, Navigation, Calendar, Camera } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#1c1917] font-sans pb-20">
      {/* Hero Header */}
      <header className="relative h-[60vh] flex items-end justify-center overflow-hidden bg-[#1c1917]">
        <div className="absolute inset-0 opacity-40 bg-gradient-to-t from-[#1c1917] to-transparent z-10" />
        <div className="absolute inset-0 bg-[#ea580c] mix-blend-overlay opacity-20" />
        
        {/* If we had a main image, we'd put it here */}
        <div className="relative z-20 text-center px-6 pb-16 max-w-4xl">
          <div className="flex justify-center mb-6">
             <div className="bg-[#ea580c]/20 backdrop-blur-md px-4 py-1 rounded-full border border-[#ea580c]/30 text-[#ea580c] text-xs font-bold uppercase tracking-widest">
               Cestovní Deník
             </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            {folder.title}
          </h1>
          <div className="flex flex-wrap justify-center gap-6 text-white/80 font-medium">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-[#ea580c]" />
              <span>{startDate} {startDate !== endDate && `- ${endDate}`}</span>
            </div>
            <div className="flex items-center gap-2">
              <Navigation size={18} className="text-[#ea580c]" />
              <span>{totalKm.toFixed(1)} km celkem</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content Timeline */}
      <main className="max-w-3xl mx-auto px-6 -mt-10 relative z-30">
        <div className="space-y-16">
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
              <article key={post.id} className="relative group">
                {/* Timeline connector */}
                {idx < posts.length - 1 && (
                  <div className="absolute left-[24px] top-[48px] bottom-[-64px] w-[2px] bg-gradient-to-b from-[#ea580c] to-[#f5f5f4] opacity-20 hidden md:block" />
                )}

                <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-xl shadow-stone-200/50 border border-stone-100 transition-all hover:shadow-2xl hover:shadow-[#ea580c]/5">
                  <header className="mb-8">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-[#ea580c] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#ea580c]/30">
                        <MapPin size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-[#ea580c] font-bold text-sm mb-0.5">
                          <Clock size={14} />
                          <span>{date.toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="opacity-30">•</span>
                          <span>{date.toLocaleDateString("cs-CZ")}</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                          {post.title}
                        </h2>
                      </div>
                    </div>
                    {post.locations?.[0] && (
                      <p className="text-stone-400 text-sm font-medium flex items-center gap-2">
                        <Navigation size={14} />
                        {post.locations[0].address}
                      </p>
                    )}
                  </header>

                  {/* Photos Grid */}
                  {post.attachments?.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      {post.attachments.filter((a:any) => a.type === 'image').map((att: any) => (
                        <div key={att.id} className="aspect-[4/3] rounded-2xl overflow-hidden shadow-md">
                          <img 
                            src={att.url} 
                            alt={att.name} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Description / Story */}
                  {post.description && (
                    <div className="prose prose-stone max-w-none">
                      <p className="text-lg text-stone-600 leading-relaxed italic border-l-4 border-[#ea580c]/20 pl-6">
                        {post.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Distance Badge */}
                {distToNext > 0.1 && (
                  <div className="flex justify-center my-8">
                    <div className="bg-[#f0fdf4] text-[#16a34a] text-xs font-bold px-4 py-1.5 rounded-full border border-[#dcfce7] shadow-sm flex items-center gap-2">
                      <Navigation size={12} />
                      Cesta k dalšímu cíli: {distToNext.toFixed(1)} km
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </main>

      <footer className="mt-32 text-center text-stone-400 text-sm font-medium">
        <p>© {new Date().getFullYear()} Questea Blog • Vygenerováno automaticky z deníku</p>
      </footer>
    </div>
  );
}
