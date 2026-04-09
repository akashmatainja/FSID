import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface AnimatedPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function AnimatedPagination({
  currentPage,
  totalPages,
  onPageChange,
}: AnimatedPaginationProps) {
  if (totalPages <= 1) return null;

  const generatePageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  const pages = generatePageNumbers();

  return (
    <div className="flex items-center justify-between border-t border-border/50 bg-card/30 px-6 py-4">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-xl border border-border/50 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-xl border border-border/50 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Showing page <span className="font-bold text-foreground">{currentPage}</span> of{" "}
            <span className="font-bold text-foreground">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-xl border border-border/50 bg-background px-2 py-2 text-muted-foreground hover:bg-muted focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
            </button>
            
            {pages.map((page, index) => {
              if (page === "...") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="relative inline-flex items-center border border-border/50 bg-background px-4 py-2 text-sm font-medium text-muted-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </span>
                );
              }

              const isCurrent = page === currentPage;
              
              return (
                <button
                  key={`page-${page}`}
                  onClick={() => onPageChange(page as number)}
                  className={`relative inline-flex items-center border px-4 py-2 text-sm font-bold focus:z-20 transition-all duration-300 ${
                    isCurrent
                      ? "z-10 bg-brand-500 border-brand-500 text-white shadow-md shadow-brand-500/20 scale-105"
                      : "border-border/50 bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {isCurrent && (
                    <motion.div
                      layoutId="pagination-indicator"
                      className="absolute inset-0 rounded-md bg-brand-500 -z-10"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{page}</span>
                </button>
              );
            })}

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-r-xl border border-border/50 bg-background px-2 py-2 text-muted-foreground hover:bg-muted focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
