import { prisma } from "@/lib/prisma";

/**
 * Calculates the distance between two points using the Haversine formula.
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Recalculates distances for all tasks within a parent folder.
 * Implements GPS calculation + Odometer calibration.
 */
export async function recalculateTaskDistances(parentId: string) {
  // Use the same ordering as the public blog for consistency
  const tasks = await prisma.task.findMany({
    where: { parentId, isDeleted: false },
    include: { locations: true }
  });

  if (tasks.length < 2) return;

  // Sort by recordedAt or createdAt to match blog's timeline
  tasks.sort((a, b) => {
    const timeA = new Date(a.recordedAt || a.createdAt).getTime();
    const timeB = new Date(b.recordedAt || b.createdAt).getTime();
    return timeA - timeB;
  });

  const corrections: Record<string, number> = {};
  
  // 1. Identify tasks with manual odometer readings
  let odoPosts = tasks.filter(t => t.odometer !== null && t.odometer !== undefined);
  
  // Fallback: If first post doesn't have odo, assume 0 for calibration baseline
  if (tasks.length > 0 && (odoPosts.length === 0 || odoPosts[0].id !== tasks[0].id)) {
    odoPosts = [{ ...tasks[0], odometer: 0 }, ...odoPosts];
  }

  // 2. Calculate calibration ratio for each segment between odometer readings
  if (odoPosts.length >= 2) {
    for (let i = 0; i < odoPosts.length - 1; i++) {
      const t1 = odoPosts[i];
      const t2 = odoPosts[i+1];
      const realSegmentDist = (t2.odometer || 0) - (t1.odometer || 0);
      
      // We only apply calibration if distance is positive
      if (realSegmentDist <= 0) continue;

      const sIdx = tasks.findIndex(t => t.id === t1.id);
      const eIdx = tasks.findIndex(t => t.id === t2.id);
      const segmentTasks = tasks.slice(sIdx, eIdx + 1);
      
      let gpsSegmentDist = 0;
      const stepDists: {id: string, dist: number}[] = [];
      
      for (let j = 0; j < segmentTasks.length - 1; j++) {
        const l1 = segmentTasks[j].locations?.[0];
        const l2 = segmentTasks[j+1].locations?.[0];
        if (l1 && l2) {
          const d = calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
          gpsSegmentDist += d;
          stepDists.push({ id: segmentTasks[j].id, dist: d });
        }
      }
      
      const ratio = gpsSegmentDist > 0 ? realSegmentDist / gpsSegmentDist : 1;
      stepDists.forEach(step => {
        corrections[step.id] = step.dist * ratio;
      });
    }
  }

  // 3. Final pass: apply distances and update DB
  for (let i = 0; i < tasks.length - 1; i++) {
    const current = tasks[i];
    const next = tasks[i+1];
    let dist = 0;

    if (corrections[current.id] !== undefined) {
      dist = corrections[current.id];
    } else {
      const l1 = current.locations?.[0];
      const l2 = next.locations?.[0];
      if (l1 && l2) {
        dist = calculateDistance(l1.latitude, l1.longitude, l2.latitude, l2.longitude);
      }
    }

    await prisma.task.update({
      where: { id: current.id },
      data: { calculatedDistance: dist }
    });
  }

  // Last task always has 0 distance to next
  await prisma.task.update({
    where: { id: tasks[tasks.length - 1].id },
    data: { calculatedDistance: 0 }
  });
}
