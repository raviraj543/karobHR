"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2, LogOut } from "lucide-react";
import React, { useState } from "react";

export default function CheckoutReportPage() {
  // For now, the button is always visible and doesn't have full functionality.
  // Geofence and check-in status will be handled in future development.
  const [tasksSubmittedForDay, setTasksSubmittedForDay] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTaskReportAndCheckout = async () => {
    setIsSubmitting(true);
    console.log(">>> KAROBHR TRACE: Submit Report & Check Out button clicked. Tasks submitted (mocked):", tasksSubmittedForDay);

    if (!tasksSubmittedForDay) {
      // Simulate submitting report
      console.log("Submitting report...");
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      setTasksSubmittedForDay(true);
      console.log("Report submitted.");
    }

    // Simulate checkout
    console.log("Performing checkout...");
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    console.log("Checkout complete.");
    // Add actual checkout logic here, potentially including geofence checks

    setIsSubmitting(false);
    // Reset for next day or further actions if needed
    // setTasksSubmittedForDay(false); 
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold flex items-center">
            <FileText className="mr-3 h-6 w-6 text-primary" />
            Report & Checkout
          </CardTitle>
          <CardDescription>
            {tasksSubmittedForDay 
              ? "You have submitted your report. You can now proceed to checkout." 
              : "Please submit your daily task report and then perform your checkout."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2">
              {tasksSubmittedForDay ? "Workday Checkout" : "Daily Task Report & Checkout"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {tasksSubmittedForDay 
                ? "Ensure you are within the designated office geofence before attempting to checkout."
                : "Submit your task report first, then you will be able to checkout."}
            </p>
            <Button 
              onClick={handleTaskReportAndCheckout} 
              className="w-full" 
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                tasksSubmittedForDay ? <LogOut className="mr-2 h-5 w-5" /> : <FileText className="mr-2 h-5 w-5" />
              )}
              {isSubmitting 
                ? (tasksSubmittedForDay ? "Checking Out..." : "Submitting Report...") 
                : (tasksSubmittedForDay ? "Check Out" : "Submit Report & Check Out")}
            </Button>
          </div>

          <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">
             <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> Geofence checks and actual check-in status integration are pending. This page currently uses mock states for report submission.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
