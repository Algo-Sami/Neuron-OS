"use client";

import React, { useState, useEffect } from "react";
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
  
  // Read and set user profile from cached Zustand auth store
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState<{
    fullName: string;
    email: string;
    avatarUrl: string | null;
  } | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (user) {
      setProfile({
        fullName: user.full_name || "Scholar Student",
        email: user.email,
        avatarUrl: user.profile_image || null,
      });
      return;
    }

    const fetchUserData = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error("TopNav getUser error:", error.message);
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
          setProfile({
            fullName: fetchedUser.full_name,
            email: fetchedUser.email,
            avatarUrl: fetchedUser.profile_image,
          });
        }
      } catch (err) {
        console.error("TopNav session load exception:", err);
      }
    };

    fetchUserData();
  }, [user, setUser]);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null); // Clear cached user details from Zustand store
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
      const res = await deleteUserAccountAction();
      if (res.success) {
        setDeleteDialogOpen(false);
        router.push("/login");
        router.refresh();
      } else {
        setDeleteError(res.error || "Failed to delete account.");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Account deletion error:", err);
      setDeleteError(errorMsg || "An unexpected error occurred. Please try again later.");
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
    <header className="flex h-13 items-center justify-between border-b border-border/80 bg-background/55 backdrop-blur-md px-6 shrink-0 relative z-30 select-none">
      <div className="flex items-center gap-3">
        {/* Workspace identifier or navigation title */}
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest select-none">Workspace</span>
        <span className="text-border text-[11px] select-none">\</span>
        <span className="text-xs font-semibold text-foreground select-none">Scholar Space</span>

        {/* Global Search Input Mockup */}
        <div className="relative hidden md:flex items-center ml-6 max-w-xs w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <div className="w-full h-8 pl-8 pr-2 flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 text-[10px] text-muted-foreground font-semibold cursor-pointer hover:border-primary/30 transition-all">
            <span>Search workspace...</span>
            <span className="text-[8px] bg-muted/65 border border-border px-1 py-0.25 rounded font-mono">⌘K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">

        {/* Notifications Icon */}
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative text-muted-foreground hover:text-foreground cursor-pointer h-8 w-8 rounded-lg">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
        </Button>

        {/* User Profile Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="relative h-8 w-8 rounded-full cursor-pointer" />
            }
          >
            <Avatar className="h-7 w-7 cursor-pointer border border-border hover:border-primary/50 transition-all duration-200">
              {profile?.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.fullName} className="object-cover" />
              ) : (
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                  {profile ? getInitials(profile.fullName) : "NR"}
                </AvatarFallback>
              )}
            </Avatar>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent className="w-56 mt-2 rounded-xl bg-card border border-border/80 shadow-md" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs font-bold text-foreground leading-none">
                    {profile?.fullName || "Loading Scholar..."}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-none overflow-hidden text-ellipsis truncate">
                    {profile?.email || "student@neuron.internal"}
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator className="bg-border/60" />
            
            <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer gap-2 p-2 text-xs text-muted-foreground hover:text-foreground rounded-lg">
              <UserIcon className="h-3.5 w-3.5" />
              Academic Profile
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer gap-2 p-2 text-xs text-muted-foreground hover:text-foreground rounded-lg">
              <Settings className="h-3.5 w-3.5" />
              System Settings
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-border/60" />
            
            <DropdownMenuItem 
              onClick={handleLogout} 
              className="cursor-pointer gap-2 p-2 text-xs text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive rounded-lg"
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
              className="cursor-pointer gap-2 p-2 text-xs text-red-500 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-500 rounded-lg"
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
