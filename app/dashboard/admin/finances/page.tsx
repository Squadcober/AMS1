"use client"

import { useState, useEffect } from "react"
import { useMediaQuery } from "react-responsive"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { CustomTooltip } from "@/components/custom-tooltip"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import { Sidebar } from "@/components/Sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { Search, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface FinancialRecord {
  id: string
  transactionId: string
  description: string
  amount: number
  quantity: number
  type: "income" | "expense"
  date: string
  academyId: string
  documentUrl?: string;
  status?: 'active' | 'deleted';
}

export default function FinancesPage() {
  const today = new Date().toISOString().split('T')[0];

  const isMobile = useMediaQuery({ maxWidth: 768 })

  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [newRecord, setNewRecord] = useState<Omit<FinancialRecord, "id" | "academyId">>({
    transactionId: "",
    description: "",
    amount: 0,
    quantity: 0,
    type: "expense",
    date: today,
  })
  const [visibleRecords, setVisibleRecords] = useState(10)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currency, setCurrency] = useState<string>("INR")
  const [conversionRates, setConversionRates] = useState<{ [key: string]: number }>({})
  const [visibleTransactions, setVisibleTransactions] = useState(10)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const currencyOptions = [
    { label: "INR (₹)", value: "INR" },
    { label: "USD ($)", value: "USD" },
    { label: "EUR (€)", value: "EUR" },
    { label: "GBP (£)", value: "GBP" },
  ]

  const fetchConversionRates = async () => {
    try {
      const response = await fetch("https://api.exchangerate-api.com/v4/latest/INR")
      if (!response.ok) throw new Error("Failed to fetch conversion rates")
      const data = await response.json()
      setConversionRates(data.rates)
    } catch (error) {
      console.error("Error fetching conversion rates:", error)
      toast({
        title: "Error",
        description: "Failed to fetch currency conversion rates",
        variant: "destructive",
      })
    }
  }

  const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) return amount
    const fromRate = conversionRates[fromCurrency] || 1
    const toRate = conversionRates[toCurrency] || 1
    return (amount / fromRate) * toRate
  }

  const formatCurrency = (amount: number) => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    })
    return formatter.format(amount)
  }

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/db/ams-finance?academyId=${user?.academyId}`)
      if (!response.ok) throw new Error('Failed to fetch transactions')
      
      const data = await response.json()
      setTransactions(data)
    } catch (error) {
      console.error('Error fetching transactions:', error)
      toast({
        title: "Error",
        description: "Failed to load financial data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetNewRecord = () => {
    setNewRecord({
      transactionId: "",
      description: "",
      amount: 0,
      quantity: 0,
      type: "expense",
      date: today,
    })
    setSelectedFile(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    } else {
      setSelectedFile(null)
    }
  }

  const uploadFile = async (file: File) => {
    try {
      setUploadingFile(true)
      
      if (!user?.academyId) {
        toast({
          title: "Error",
          description: "Academy ID not found. Please try again.",
          variant: "destructive",
        })
        return null
      }

      const formData = new FormData()
      formData.append('file', file)
      const academyId = String(user.academyId).trim()
      formData.append('academyId', academyId)

      console.log('Uploading with academyId:', academyId)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload file')
      }
      
      const data = await response.json()
      if (!data.docId) {
        throw new Error('No document ID received from server')
      }
      
      return `/api/docs/${data.docId}`
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      })
      return null
    } finally {
      setUploadingFile(false)
    }
  }

  const handleAddTransaction = async () => {
    // Validation
    if (!newRecord.description.trim()) {
      toast({
        title: "Error",
        description: "Please enter a description",
        variant: "destructive",
      })
      return
    }

    if (!newRecord.amount || newRecord.amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      let documentUrl = undefined
      
      // Upload file first if selected
      if (selectedFile) {
        const uploadResponse = await uploadFile(selectedFile)
        if (!uploadResponse) {
          throw new Error('File upload failed')
        }
        documentUrl = uploadResponse
      }

      // Create the transaction
      const response = await fetch('/api/db/ams-finance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newRecord,
          academyId: user?.academyId,
          documentUrl: documentUrl
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add transaction')
      }

      toast({
        title: "Success",
        description: "Transaction added successfully",
      })

      // Reset form and close dialog
      resetNewRecord()
      setIsDialogOpen(false)
      
      // Refresh transactions
      await fetchTransactions()
      
    } catch (error) {
      console.error('Error adding transaction:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add transaction",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRecord = async (recordId: string) => {
    try {
      setIsDeleting(true)
      
      if (!recordId) {
        throw new Error('Transaction ID is undefined')
      }

      const response = await fetch(`/api/db/ams-finance`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: recordId,
          status: 'deleted'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete transaction')
      }

      // Update transaction in state instead of removing it
      setTransactions(prev => prev.map(t => 
        t._id === recordId ? { ...t, status: 'deleted' } : t
      ))

      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      })

      // Reset the record to delete
      setRecordToDelete(null)

    } catch (error) {
      console.error('Error deleting transaction:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete transaction",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleViewMore = () => {
    setVisibleTransactions((prev) => prev + 10)
  }

  // Reset form when dialog closes
  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      resetNewRecord()
    }
  }

  useEffect(() => {
    if (user?.academyId) {
      fetchTransactions()
    }
  }, [user?.academyId])

  useEffect(() => {
    fetchConversionRates()
  }, [])

  const calculateTotals = () => {
    const activeTransactions = transactions.filter(item => item.status !== 'deleted')
    
    const totalIncome = activeTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0)

    const totalExpense = activeTransactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0)

    const convertedIncome = convertCurrency(totalIncome, "INR", currency)
    const convertedExpense = convertCurrency(totalExpense, "INR", currency)

    return {
      totalIncome: convertedIncome,
      totalExpense: convertedExpense,
      balance: convertedIncome - convertedExpense,
    }
  }

  const { totalIncome, totalExpense, balance } = calculateTotals()

  const getChartData = () => {
    const sortedRecords = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const labels = sortedRecords.map((record) => record.date)
    const incomeData = sortedRecords.map((record) => (record.type === "income" ? record.amount : 0))
    const expenseData = sortedRecords.map((record) => (record.type === "expense" ? record.amount : 0))

    return {
      labels,
      datasets: [
        {
          label: "Income",
          data: incomeData,
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
        },
        {
          label: "Expense",
          data: expenseData,
          borderColor: "rgb(255, 99, 132)",
          tension: 0.1,
        },
      ],
    }
  }

  const getFilteredRecords = () => {
    return transactions
      .filter(record => 
        record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, visibleRecords)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col space-y-6 overflow-auto p-4">
        <div className="flex justify-between items-center">
          <CustomTooltip content="View and manage academy finances">
            <h1 className="text-3xl font-bold text-white">Finances</h1>
          </CustomTooltip>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-muted-foreground">
              Academy ID: {user?.academyId}
            </div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="border rounded-md p-2 bg-white text-black"
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          <CustomTooltip content="Total income from all sources">
            <Card>
              <CardHeader>
                <CardTitle>Total Income</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalIncome)}</p>
              </CardContent>
            </Card>
          </CustomTooltip>
          <CustomTooltip content="Total expenses across all categories">
            <Card>
              <CardHeader>
                <CardTitle>Total Expense</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalExpense)}</p>
              </CardContent>
            </Card>
          </CustomTooltip>
          <CustomTooltip content="Current balance (Income - Expenses)">
            <Card>
              <CardHeader>
                <CardTitle>Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${balance >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatCurrency(balance)}
                </p>
              </CardContent>
            </Card>
          </CustomTooltip>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Financial Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={getChartData()} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </CardContent>
        </Card>

        <CustomTooltip content="Detailed breakdown of financial transactions">
          <Card>
            <CardHeader>
              <div className="flex flex-col space-y-4">
                <div className="flex justify-between items-center">
                  <CardTitle>Financial Transactions</CardTitle>
                  <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Add Transaction</Button>
                    </DialogTrigger>
                    <DialogContent className={`${isMobile ? 'max-h-[50vh]' : 'max-h-[90vh]'} overflow-y-auto`}>
                      <DialogHeader>
                        <DialogTitle>Add New Transaction</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="description" className="text-right">
                            Description
                          </Label>
                          <Input
                            id="description"
                            value={newRecord.description}
                            onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
                            className="col-span-3"
                            placeholder="Enter transaction description"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="amount" className="text-right">
                            Amount
                          </Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={newRecord.amount || ''}
                            onChange={(e) => setNewRecord({ ...newRecord, amount: Number.parseFloat(e.target.value) || 0 })}
                            className="col-span-3"
                            placeholder="Enter amount"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="quantity" className="text-right">
                            Quantity
                          </Label>
                          <Input
                            id="quantity"
                            type="number"
                            min="0"
                            value={newRecord.quantity === 0 ? '' : newRecord.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewRecord({ ...newRecord, quantity: val === '' ? 0 : parseInt(val) || 0 });
                            }}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="type" className="text-right">
                            Type
                          </Label>
                          <select
                            id="type"
                            value={newRecord.type}
                            onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value as "income" | "expense" })}
                            className="col-span-3 border rounded-md p-2"
                          >
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="date" className="text-right">
                            Date
                          </Label>
                          <Input
                            id="date"
                            type="date"
                            max={today}
                            value={newRecord.date}
                            onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="document" className="text-right">
                            Invoice/Document
                          </Label>
                          <div className="col-span-3">
                            <Input
                              id="document"
                              type="file"
                              accept="image/*,.pdf"
                              onChange={handleFileChange}
                              className="cursor-pointer"
                            />
                            {selectedFile && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Selected: {selectedFile.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => handleDialogOpenChange(false)}
                          disabled={isSubmitting || uploadingFile}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleAddTransaction}
                          disabled={isSubmitting || uploadingFile}
                        >
                          {isSubmitting ? "Adding..." : uploadingFile ? "Uploading..." : "Add Transaction"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions by description or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions
                    .filter(record => record.status !== 'deleted')
                    .slice(0, visibleTransactions)
                    .map((record) => (
                    <TableRow key={record._id}>
                      <TableCell className="font-mono text-sm">
                        {record.transactionId || 'N/A'}
                      </TableCell>
                      <TableCell>{record.description}</TableCell>
                      <TableCell>
                        {formatCurrency(
                          convertCurrency(record.amount, "INR", currency)
                        )}
                      </TableCell>
                      <TableCell>{record.quantity ?? 1}</TableCell>
                      <TableCell className="capitalize">{record.type}</TableCell>
                      <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {record.documentId ? (
                          <a
                            href={`/api/docs/${record.documentId}`}
                            download
                            className="text-blue-500 hover:underline"
                          >
                            View Document
                          </a>
                        ) : (
                          "No document"
                        )}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setRecordToDelete(record)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this transaction? This action cannot be undone.
                                <br /><br />
                                <strong>Transaction Details:</strong>
                                <br />
                                • Description: {record.description}
                                <br />
                                • Amount: {formatCurrency(convertCurrency(record.amount, "INR", currency))}
                                <br />
                                • Type: {record.type}
                                <br />
                                • Date: {new Date(record.date).toLocaleDateString()}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel 
                                onClick={() => setRecordToDelete(null)}
                                disabled={isDeleting}
                              >
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRecord(record._id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={isDeleting}
                              >
                                {isDeleting ? "Deleting..." : "Delete Transaction"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {visibleTransactions < transactions.filter(record => record.status !== 'deleted').length && (
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={handleViewMore}
                >
                  View More ({transactions.filter(record => record.status !== 'deleted').length - visibleTransactions} remaining)
                </Button>
              )}
            </CardContent>
          </Card>
        </CustomTooltip>
      </div>
    </div>
  )
}