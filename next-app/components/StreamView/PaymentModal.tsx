import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/context/socket-context";
import { toast } from "sonner";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  spaceId: string;
  userId: string;
  userTokens: number;
  currentPaidAmount: number;
};

export default function PaymentModal({
  isOpen,
  onClose,
  streamId,
  spaceId,
  userId,
  userTokens,
  currentPaidAmount,
}: Props) {
  const [additionalAmount, setAdditionalAmount] = useState<number>(0);
  const { sendMessage } = useSocket();

  const handlePayment = async () => {
    if (additionalAmount <= 0) {
      toast.error("Please enter a valid amount to boost");
      return;
    }

    if (additionalAmount > userTokens) {
      toast.error("Insufficient tokens");
      return;
    }

    sendMessage("boost-song", {
      streamId,
      spaceId,
      userId,
      amount: additionalAmount,
    });

    onClose();
    toast.success("Boost successful! Your song will be prioritized.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Boost Your Song</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>Current boost amount: <span className="font-semibold text-yellow-500">{currentPaidAmount} 🪙</span></p>
            <p>Your available tokens: <span className="font-semibold text-green-500">{userTokens} 🪙</span></p>
            <p>Enter additional tokens to boost your song further:</p>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            type="number"
            min={1}
            max={userTokens}
            value={additionalAmount}
            onChange={(e) => setAdditionalAmount(parseInt(e.target.value) || 0)}
            placeholder="Enter additional tokens to boost"
          />
          {additionalAmount > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              New total boost will be: <span className="font-semibold text-yellow-500">{currentPaidAmount + additionalAmount} 🪙</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePayment}>
            Boost Song
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 