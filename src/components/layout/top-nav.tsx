"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, User as UserIcon, Settings, Trash2, AlertTriangle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteUserAccountAction } from "@/actions/auth";
import { useAuthStore } from "@/store";

export function TopNav() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  
  // Derived user profile from cached Zustand auth store
  const profile = user ? {
    fullName: user.full_name || "Scholar Student",
    email: user.email,
    avatarUrl: user.profile_image || null,
  } : null;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const fetchUserData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        // "Auth session missing!" is an expected transient state during
        // initial hydration — not a real error, so suppress the red log.
        return;
      }
      const supabaseUser = data?.user;
      if (supabaseUser) {
        // Fetch supplementary profile columns
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("full_name, email, profile_image, username")
          .eq("id", supabaseUser.id)
          .maybeSingle();

        const fetchedUser = {
          id: supabaseUser.id,
          full_name: profileRow?.full_name || supabaseUser.user_metadata?.full_name || "Scholar Student",
          email: supabaseUser.email || profileRow?.email || "student@neuron.internal",
          profile_image: profileRow?.profile_image || supabaseUser.user_metadata?.avatar_url || null,
          username: profileRow?.username || supabaseUser.user_metadata?.username || "",
        };

        setUser(fetchedUser);
      }
    } catch (err) {
      console.error("TopNav session load exception:", err);
    }
  }, [setUser]);

  useEffect(() => {
    if (user) return;
    fetchUserData();
  }, [user, fetchUserData]);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null); // Clear cached user details from Zustand store
      // Remove legacy unscoped keys so the next user on this browser starts fresh
      localStorage.removeItem("neuron-explorer-favorites");
      localStorage.removeItem("neuron-explorer-recent");
      localStorage.removeItem("neuron_study_coach_last_session");
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Log out failed:", err);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    
    setDeleteLoading(true);
    setDeleteError("");
    
    try {
      console.log("Starting account deletion");
      const res = await deleteUserAccountAction();
      if (res.success) {
        setDeleteDialogOpen(false);
        alert("Your account has been permanently deleted.");
        router.push("/login");
        router.refresh();
      } else {
        console.error("Account deletion failed with response:", res.error);
        setDeleteError(res.error || "Account deletion failed. Please try again or contact support.");
      }
    } catch (err: any) {
      console.error("Account deletion error:", err);
      setDeleteError(err?.message || "Account deletion failed. Please try again or contact support.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header
      className="flex h-12 items-center justify-between border-b border-[#d0d4db] bg-[#ffffff] px-5 shrink-0 relative z-30 select-none"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif' }}
    >
      <div className="flex items-center gap-3">
        {/* Workspace identifier or navigation title */}
        <div className="flex items-center gap-1.5 text-xs select-none">
          <span className="text-[11px] font-bold text-[#605e5c] uppercase tracking-wider">Workspace</span>
          <span className="text-[#a19f9d] text-[11px]">/</span>
          <span className="text-xs font-semibold text-[#201f1e]">Scholar</span>
        </div>

        {/* Search scholar input */}
        <div className="relative hidden md:flex items-center ml-4 w-[220px]">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#605e5c] pointer-events-none" />
          <input
            type="text"
            placeholder="Search scholar..."
            className="w-full h-7.5 pl-8 pr-8 rounded border border-[#d0d4db] bg-[#f8fafc] text-xs text-[#201f1e] placeholder:text-[#605e5c] hover:bg-[#ffffff] hover:border-[#0078d4] focus:bg-[#ffffff] focus:border-[#0078d4] focus:outline-none transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const query = e.currentTarget.value.trim();
                if (query) router.push(`/subjects?q=${encodeURIComponent(query)}`);
              }
            }}
          />
          <span className="absolute right-1.5 top-1.5 text-[9px] bg-[#edebe9] text-[#605e5c] border border-[#d0d4db] px-1.5 py-0.25 rounded font-mono select-none pointer-events-none">
            ⌘K
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">

        {/* Notifications Icon */}
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative text-[#605e5c] hover:text-[#201f1e] hover:bg-[#f3f2f1] cursor-pointer h-7.5 w-7.5 rounded">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#0078d4] shrink-0" />
        </Button>

        {/* User Profile Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="relative h-7.5 w-7.5 rounded-full cursor-pointer p-0 hover:opacity-85 transition-opacity" />
            }
          >
            <Avatar className="h-7 w-7 cursor-pointer border border-[#d0d4db] hover:border-[#0078d4] transition-colors">
              {profile?.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.fullName} className="object-cover" />
              ) : (
                <AvatarFallback className="bg-[#eff6fc] text-[#0078d4] text-[11px] font-semibold">
                  {profile ? getInitials(profile.fullName) : "NR"}
                </AvatarFallback>
              )}
            </Avatar>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent className="w-56 mt-1 rounded-md bg-[#ffffff] border border-[#d0d4db] shadow-md" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-xs font-semibold text-[#201f1e] leading-none">
                    {profile?.fullName || "Loading Scholar..."}
                  </p>
                  <p className="text-[11px] text-[#605e5c] leading-none overflow-hidden text-ellipsis truncate mt-1">
                    {profile?.email || "student@neuron.internal"}
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator className="bg-[#e1dfdd]" />
            
            <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer gap-2 p-2 text-xs text-[#323130] hover:bg-[#f3f2f1] hover:text-[#000000] rounded">
              <UserIcon className="h-3.5 w-3.5 text-[#605e5c]" />
              Academic Profile
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer gap-2 p-2 text-xs text-[#323130] hover:bg-[#f3f2f1] hover:text-[#000000] rounded">
              <Settings className="h-3.5 w-3.5 text-[#605e5c]" />
              System Settings
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-[#e1dfdd]" />
            
            <DropdownMenuItem 
              onClick={handleLogout} 
              className="cursor-pointer gap-2 p-2 text-xs text-[#d13438] hover:bg-[#fdf3f4] rounded"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out of Neuron
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => {
                setDeleteDialogOpen(true);
                setConfirmText("");
                setDeleteError("");
              }}
              className="cursor-pointer gap-2 p-2 text-xs text-[#d13438] hover:bg-[#fdf3f4] rounded"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Account Deletion Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card border border-border/80 p-6 rounded-xl shadow-2xl relative overflow-hidden">
          
          <DialogHeader className="gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-foreground">
                  Delete Account
                </DialogTitle>
                <DialogDescription className="text-[10px] text-destructive/80 font-bold uppercase tracking-wider mt-0.5">
                  Warning: Irreversible Action
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 my-4 relative z-10">
            <div className="p-4 rounded-lg bg-muted/40 border border-border/60 text-muted-foreground text-xs leading-relaxed">
              <p className="font-bold text-foreground mb-1.5">Are you absolutely sure?</p>
              <p className="text-muted-foreground">
                This will completely wipe your account from our systems. You will lose access to:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground font-medium">
                <li>All uploaded notes & lecture slides</li>
                <li>Your quizzes, study history, and focus session stats</li>
                <li>Your total XP, active streak, and leaderboard standings</li>
                <li>Your private AI assistant discussions</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-foreground/80 block">
                To verify, type <span className="font-mono text-destructive bg-destructive/10 px-1.5 py-0.5 rounded font-bold">DELETE</span> below:
              </label>
              <input
                type="text"
                placeholder="Type 'DELETE' to confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={deleteLoading}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-destructive focus:border-destructive transition-all font-mono"
              />
            </div>

            {deleteError && (
              <div className="text-xs text-destructive font-semibold bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
                {deleteError}
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeleteDialogOpen(false);
                setConfirmText("");
                setDeleteError("");
              }}
              disabled={deleteLoading}
              className="w-full sm:w-auto text-xs"
            >
              Cancel & Go Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteLoading || confirmText !== "DELETE"}
              className="w-full sm:w-auto min-w-[140px] bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-bold transition-all shadow-xs"
            >
              {deleteLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 inline" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5 inline" />
              )}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
