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
};

export default function PaymentModal({
  isOpen,
  onClose,
  streamId,
  spaceId,
  userId,
  userTokens,
}: Props) {
  const [amount, setAmount] = useState<number>(0);
  const { sendMessage } = useSocket();

  const handlePayment = async () => {
    if (amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount > userTokens) {
      toast.error("Insufficient tokens");
      return;
    }

    sendMessage("boost-song", {
      streamId,
      spaceId,
      userId,
      amount,
    });

    onClose();
    toast.success("Payment successful! Your song will be prioritized.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Boost Your Song</DialogTitle>
          <DialogDescription>
            Use your tokens to boost your song's position in the queue. You have {userTokens} tokens available.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            type="number"
            min={0}
            max={userTokens}
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            placeholder="Enter amount of tokens"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePayment}>
            Pay Tokens
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 