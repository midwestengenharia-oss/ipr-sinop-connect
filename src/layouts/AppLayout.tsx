import Navbar from "@/components/Navbar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navbar />
            <main className="container mx-auto px-4 py-6">
                <Outlet />
            </main>
        </div>
    );
}
