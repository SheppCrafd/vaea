import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';


export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="max-w-md w-full">
                <div className="text-center space-y-6">
                    {/* 404 Error Code */}
                    <div className="space-y-2">
                        <h1 className="font-heading text-7xl font-light text-muted-foreground/50">404</h1>
                        <div className="h-0.5 w-16 bg-border mx-auto"></div>
                    </div>

                    {/* Main Message */}
                    <div className="space-y-3">
                        <h2 className="font-heading text-2xl font-medium text-foreground">
                            Page Not Found
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            The page <span className="font-medium text-foreground">"{pageName}"</span> could not be found in this application.
                        </p>
                    </div>

                    {/* Action Button */}
                    <div className="pt-6">
                        <Button variant="outline" onClick={() => window.location.href = '/'} className="gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Go Home
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
