"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { SelectDocument } from "@/types"
import { useState, useEffect } from "react"
import { updateDocumentSharingAction } from "@/actions/db/documents-actions"
import { toast } from "sonner"
import { Copy } from "lucide-react"

interface DocumentShareDialogProps {
  document: SelectDocument
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onDocumentUpdate: (updatedDocument: SelectDocument) => void
}

export function DocumentShareDialog({
  document,
  isOpen,
  onOpenChange,
  onDocumentUpdate
}: DocumentShareDialogProps) {
  const [isPublic, setIsPublic] = useState(document.isPublic)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsPublic(document.isPublic)
  }, [document])

  const getAppUrl = () => {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL
    }
    // Fallback to current origin if env var not set
    if (typeof window !== "undefined") {
      return window.location.origin
    }
    return ""
  }

  const appUrl = getAppUrl()
  const shareableLink =
    document.isPublic && document.slug ? `${appUrl}/view/${document.slug}` : ""

  const handleSharingToggle = async (checked: boolean) => {
    setIsLoading(true)
    try {
      const result = await updateDocumentSharingAction(document.id, checked)
      if (result.isSuccess) {
        toast.success(
          `Document is now ${result.data.isPublic ? "public" : "private"}`
        )
        onDocumentUpdate(result.data)
      } else {
        toast.error(result.message)
        setIsPublic(document.isPublic) // Revert on failure
      }
    } catch (error) {
      toast.error("Failed to update sharing settings.")
      setIsPublic(document.isPublic) // Revert on failure
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (shareableLink) {
      navigator.clipboard.writeText(shareableLink)
      toast.success("Link copied to clipboard!")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>
            Manage sharing settings for your document. Public documents can be
            viewed by anyone with the link.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <Label htmlFor="sharing-toggle" className="flex flex-col gap-1">
              <span>Make Document Public</span>
              <span className="text-muted-foreground text-xs font-normal">
                Anyone with the link can view.
              </span>
            </Label>
            <Switch
              id="sharing-toggle"
              checked={isPublic}
              onCheckedChange={handleSharingToggle}
              disabled={isLoading}
            />
          </div>

          {isPublic && shareableLink && (
            <div className="mt-4">
              <Label htmlFor="share-link">Shareable Link</Label>
              <div className="mt-1 flex gap-2">
                <Input id="share-link" value={shareableLink} readOnly />
                <Button onClick={copyToClipboard} size="icon" variant="outline">
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
