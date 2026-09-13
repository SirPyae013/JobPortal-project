import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, X } from "lucide-react";
import { fetchNotifications, markAllNotificationsRead } from "../services/api";

export default function NotificationsModal({ isOpen, onClose, onRead }: { isOpen: boolean; onClose: () => void; onRead: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  useEffect(() => {
    setItems([]);
    setError("");
    if (!isOpen) return;
    const controller = new AbortController();
    setLoading(true);
    fetchNotifications(controller.signal)
      .then(items => { if (!controller.signal.aborted) setItems(items); })
      .catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isOpen]);

  return <AnimatePresence>{isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 bg-[#001142]/40 backdrop-blur-sm"/><motion.section initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}} className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-7 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold text-[#001142]">Notifications</h2><p className="mt-1 text-sm text-slate-500">Updates for your account</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5"/></button></div><button disabled={loading || markingRead || !items.length} onClick={async()=>{setMarkingRead(true);setError("");try{await markAllNotificationsRead();setItems(items => items.map((item)=>({...item,is_read:true})));onRead();}catch(error){setError(error instanceof Error ? error.message : "Unable to mark notifications as read.");}finally{setMarkingRead(false);}}} className="mt-5 text-sm font-bold text-[#016a61]">Mark all as read</button>{error && <p className="mt-4 text-sm text-red-600">{error}</p>}<div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto">{items.map((item)=><article key={item.id} className={`rounded-xl border p-4 ${item.is_read?'bg-white':'border-[#016a61]/20 bg-[#eafaf7]'}`}><div className="flex gap-3"><Bell className="mt-0.5 h-4 w-4 text-[#016a61]"/><div><h3 className="text-sm font-bold text-[#001142]">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.message}</p><p className="mt-2 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p></div></div></article>)}{loading && <p role="status" className="py-10 text-center text-sm text-slate-500">Loading your notifications?</p>}{!loading&&!items.length&&!error&&<p className="py-10 text-center text-sm text-slate-500">No notifications yet.</p>}</div></motion.section></div>}</AnimatePresence>;
}
