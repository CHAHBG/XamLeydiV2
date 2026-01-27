import { LayoutDashboard, Users, FileText, Settings, HelpCircle, LogOut } from 'lucide-react';

export function Sidebar() {
    return (
        <aside className="w-64 bg-slate-900 text-white flex flex-col fixed inset-y-0 left-0 z-50 transition-all duration-300">
            {/* Logo Area */}
            <div className="h-20 flex items-center px-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-500 rounded-lg">
                        <LayoutDashboard size={20} className="text-white" />
                    </div>
                    <h1 className="text-lg font-bold tracking-tight text-white">Xamleydi</h1>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-1">
                <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Menu Principal
                </div>

                <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-600 text-white transition-colors group">
                    <LayoutDashboard size={20} />
                    <span className="font-medium">Tableau de bord</span>
                </a>

                <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors group">
                    <Users size={20} />
                    <span className="font-medium">Utilisateurs</span>
                </a>

                <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors group">
                    <FileText size={20} />
                    <span className="font-medium">Rapports</span>
                </a>

                <div className="px-3 mt-8 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Système
                </div>

                <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors group">
                    <Settings size={20} />
                    <span className="font-medium">Paramètres</span>
                </a>

                <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors group">
                    <HelpCircle size={20} />
                    <span className="font-medium">Aide & Support</span>
                </a>
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                        AD
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <h4 className="text-sm font-medium text-white truncate">Admin User</h4>
                        <p className="text-xs text-slate-400 truncate">admin@xamleydi.sn</p>
                    </div>
                    <LogOut size={18} className="text-slate-500 hover:text-white transition-colors" />
                </div>
            </div>
        </aside>
    );
}
