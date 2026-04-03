"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Search, FileText } from "lucide-react";

interface RAGDocument {
  id: string;
  title: string;
  content: string;
  source?: string;
  metadata?: any;
  createdAt: string;
  chunks: Array<{
    id: string;
    chunkIndex: number;
    content: string;
  }>;
}

interface SearchResult {
  id: string;
  documentTitle: string;
  documentSource?: string;
  chunkIndex: number;
  content: string;
}

export default function RAGPage() {
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [newDocSource, setNewDocSource] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/rag/documents");
      const data = await response.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    }
  };

  const handleAddDocument = async () => {
    if (!newDocTitle || !newDocContent) return;

    setLoading(true);
    try {
      const response = await fetch("/api/rag/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDocTitle,
          content: newDocContent,
          source: newDocSource || undefined,
        }),
      });

      if (response.ok) {
        setNewDocTitle("");
        setNewDocContent("");
        setNewDocSource("");
        setIsAddDialogOpen(false);
        fetchDocuments();
      }
    } catch (error) {
      console.error("Failed to add document:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("确定要删除这个文档吗？")) return;

    try {
      const response = await fetch(`/api/rag/documents/${documentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, topK: 5 }),
      });

      const data = await response.json();
      if (data.results) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error("Failed to search:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">RAG 知识库管理</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加文档
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>添加新文档</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">标题</label>
                <Input
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="输入文档标题"
                />
              </div>
              <div>
                <label className="text-sm font-medium">来源（可选）</label>
                <Input
                  value={newDocSource}
                  onChange={(e) => setNewDocSource(e.target.value)}
                  placeholder="输入文档来源"
                />
              </div>
              <div>
                <label className="text-sm font-medium">内容</label>
                <Textarea
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder="输入文档内容"
                  rows={10}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleAddDocument} disabled={loading}>
                  {loading ? "添加中..." : "添加"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">知识库检索</h2>
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="输入查询内容..."
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            搜索
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-4">
            <h3 className="text-lg font-medium">搜索结果</h3>
            {searchResults.map((result) => (
              <Card key={result.id} className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 mt-0.5 text-blue-500" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{result.documentTitle}</span>
                      {result.documentSource && (
                        <span className="text-sm text-gray-500">
                          ({result.documentSource})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{result.content}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">文档列表 ({documents.length})</h2>
        {documents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            暂无文档，点击上方"添加文档"按钮开始添加
          </p>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <h3 className="font-semibold">{doc.title}</h3>
                      {doc.source && (
                        <span className="text-sm text-gray-500">
                          来源: {doc.source}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {doc.content}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {doc.chunks.length} 个片段 ·{" "}
                      {new Date(doc.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteDocument(doc.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
