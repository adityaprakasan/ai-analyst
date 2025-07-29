# Keyword Analysis Script
# Analyzes search keywords with intent classification, branded vs non-branded split

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
import re
import json
from typing import Optional, Dict, List, Set, Tuple

# Set up Matplotlib to use Poppins font if available
try:
    import matplotlib.font_manager as fm
    font_path = '/tmp/Poppins-Regular.ttf'
    if os.path.exists(font_path):
        fm.fontManager.addfont(font_path)
        plt.rc('font', family='Poppins')
except:
    pass

# Google colors
GOOGLE_BLUE = '#4285F4'
GOOGLE_RED = '#EA4335'
GOOGLE_YELLOW = '#FBBC05'
GOOGLE_GREEN = '#34A853'
colors = [GOOGLE_BLUE, GOOGLE_RED, GOOGLE_YELLOW, GOOGLE_GREEN]

def validate_columns(df: pd.DataFrame, required_cols: Set[str], error_msg: str) -> bool:
    """Validate required columns exist in DataFrame."""
    missing_cols = required_cols - set(df.columns)
    
    if missing_cols:
        return False
    return True

def validate_df_structure(df: pd.DataFrame, required_cols: Set[str]) -> Tuple[bool, List[str]]:
    """Validate CSV structure and data types."""
    errors = []
    
    if not validate_columns(df, required_cols, "file is missing required columns."):
        missing = required_cols - set(df.columns)
        errors.append(f"Missing columns: {', '.join(missing)}")
        return False, errors
    
    # Validate numeric columns
    if not pd.api.types.is_numeric_dtype(df['Traffic']):
        errors.append("'Traffic' column must contain only numbers.")
    
    if not pd.api.types.is_numeric_dtype(df['Search Volume']):
        errors.append("'Search Volume' column must contain only numbers.")
    
    # Validate timestamp
    try:
        pd.to_datetime(df['Timestamp'], errors='raise')
    except (ValueError, TypeError) as e:
        errors.append(f"'Timestamp' column contains invalid dates: {str(e)}")
    
    return len(errors) == 0, errors

def clean_df(raw_df: pd.DataFrame, required_cols: Set[str], valid_intents: Set[str]) -> Optional[pd.DataFrame]:
    """Clean and process the DataFrame."""
    # Create new DF with required columns
    cleaned_df = raw_df[list(required_cols)].copy()
    
    # Clean columns
    cleaned_df['Keyword'] = cleaned_df['Keyword'].str.strip().str.lower()
    cleaned_df['Traffic'] = pd.to_numeric(cleaned_df['Traffic'], errors='coerce').fillna(0)
    cleaned_df['Search Volume'] = pd.to_numeric(cleaned_df['Search Volume'], errors='coerce').fillna(0)
    cleaned_df['Timestamp'] = pd.to_datetime(cleaned_df['Timestamp'], errors='coerce')
    
    # Drop invalid rows
    cleaned_df.dropna(subset=['Keyword', 'Timestamp'], inplace=True)
    cleaned_df = cleaned_df[cleaned_df['Keyword'] != '']
    
    # Add YearMonth
    cleaned_df['YearMonth'] = cleaned_df['Timestamp'].dt.to_period('M')
    
    # Reconcile duplicates
    reconciled_df = cleaned_df.groupby(['Keyword', 'YearMonth', 'Keyword Intents']).agg({
        'Traffic': 'sum',
        'Search Volume': 'max'
    }).sort_values(by=['Traffic', 'Search Volume'], ascending=False).reset_index()
    
    # Process intents
    df_with_intents = reconciled_df.assign(
        Intent=reconciled_df['Keyword Intents'].fillna('').str.split(',')
    ).explode('Intent')
    
    df_with_intents['Intent'] = df_with_intents['Intent'].str.strip().str.lower()
    df_with_intents = df_with_intents[df_with_intents['Intent'].isin(valid_intents)]
    
    final_df = df_with_intents.drop(columns=['Keyword Intents'])
    
    return final_df.astype({
        'Keyword': 'string',
        'Traffic': 'int64',
        'Search Volume': 'int64',
        'Intent': 'string'
    })

def plot_pie_chart(values, labels, chart_title, figsize=(6, 6)):
    """Create donut chart."""
    fig, ax = plt.subplots(figsize=figsize)
    
    wedges, texts = ax.pie(
        values,
        colors=colors[:len(values)][::-1],
        startangle=90,
        wedgeprops={'width': 0.4, 'edgecolor': 'w'}
    )
    
    total = sum(values)
    legend_labels = [f'{l} ({s/total:.1%})' for l, s in zip(labels, values)]
    
    ax.legend(
        wedges[::-1],
        legend_labels[::-1],
        loc="center left",
        bbox_to_anchor=(1, 0, 0.5, 1),
        fontsize=12
    )
    
    ax.set_title(chart_title, fontsize=14, pad=20)
    ax.axis('equal')
    
    return fig

def plot_monthly_bar_chart(pivoted_df, chart_title, ylabel, figsize=(12, 7)):
    """Create monthly bar chart."""
    fig, ax = plt.subplots(figsize=figsize)
    
    pivoted_df.plot(
        kind="bar",
        ax=ax,
        color=colors[:len(pivoted_df.columns)],
        width=0.8,
        zorder=3
    )
    
    ax.grid(axis='y', linestyle='--', alpha=0.7, zorder=0)
    ax.set_title(chart_title, fontsize=16, pad=20)
    ax.set_xlabel('Year-Month', fontsize=12)
    ax.set_ylabel(ylabel, fontsize=12)
    
    ax.set_xticklabels([item.strftime('%Y-%m') for item in pivoted_df.index], rotation=45, ha='right')
    ax.legend(title="Category")
    plt.tight_layout()
    
    return fig

def run_analysis(input_file: str, output_dir: str, config: Optional[Dict] = None) -> Dict:
    """Main analysis function for keyword analysis."""
    results = {
        "success": False,
        "errors": [],
        "artifacts": [],
        "summary": {}
    }
    
    # Default config
    if config is None:
        config = {}
    
    required_cols = set(config.get('required_columns', 
        ['Keyword', 'Traffic', 'Search Volume', 'Timestamp', 'Keyword Intents']))
    valid_intents = set(config.get('valid_intents', 
        ['commercial', 'informational', 'transactional', 'navigational']))
    brand_keywords = config.get('brand_keywords', ['flavour blaster', 'flavourblaster'])
    
    try:
        # Read CSV
        df = pd.read_csv(input_file)
        
        # Validate
        is_valid, errors = validate_df_structure(df, required_cols)
        if not is_valid:
            results["errors"] = errors
            return results
        
        # Clean data
        clean_data = clean_df(df, required_cols, valid_intents)
        if clean_data is None:
            results["errors"].append("Failed to clean data")
            return results
        
        # Add branded/non-branded classification
        brand_pattern = '|'.join(brand_keywords)
        clean_data['Category'] = np.where(
            clean_data['Keyword'].str.contains(brand_pattern, case=False, na=False),
            'branded',
            'non-branded'
        )
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Get date range from config or use most recent 6 months
        if config.get('date_range'):
            start_month = config['date_range'].get('start')
            end_month = config['date_range'].get('end')
        else:
            end_month = clean_data['YearMonth'].max()
            start_month = end_month - 5  # 6 months including end month
        
        # Filter data
        filtered_df = clean_data[
            (clean_data['YearMonth'] >= pd.Period(start_month, 'M')) & 
            (clean_data['YearMonth'] <= pd.Period(end_month, 'M'))
        ]
        
        # Monthly aggregations
        monthly_totals = filtered_df.groupby(['YearMonth', 'Category']).agg({
            'Traffic': 'sum',
            'Search Volume': 'max'
        }).reset_index()
        
        # Create visualizations
        
        # 1. Monthly traffic by category
        pivoted_traffic = monthly_totals.pivot_table(
            index='YearMonth',
            columns='Category',
            values='Traffic'
        ).fillna(0)
        
        fig1 = plot_monthly_bar_chart(
            pivoted_traffic,
            "Branded vs Non-branded Traffic over time",
            'Traffic'
        )
        chart1_path = os.path.join(output_dir, 'traffic_by_category.png')
        fig1.savefig(chart1_path, dpi=150, bbox_inches='tight')
        plt.close(fig1)
        results["artifacts"].append({
            "name": "traffic_by_category.png",
            "type": "chart",
            "path": chart1_path
        })
        
        # 2. Pie chart - branded vs non-branded
        category_totals = filtered_df.drop_duplicates(subset=['Keyword', 'YearMonth']).groupby('Category')['Traffic'].sum()
        
        fig2 = plot_pie_chart(
            category_totals.values,
            category_totals.index,
            'Branded vs Non-Branded Traffic'
        )
        chart2_path = os.path.join(output_dir, 'branded_split.png')
        fig2.savefig(chart2_path, dpi=150, bbox_inches='tight')
        plt.close(fig2)
        results["artifacts"].append({
            "name": "branded_split.png",
            "type": "chart",
            "path": chart2_path
        })
        
        # 3. Intent distribution
        intent_totals = filtered_df.drop_duplicates(subset=['Keyword', 'YearMonth', 'Intent']).groupby('Intent')['Traffic'].sum()
        
        fig3 = plot_pie_chart(
            intent_totals.values,
            intent_totals.index,
            'Traffic by Intent'
        )
        chart3_path = os.path.join(output_dir, 'intent_distribution.png')
        fig3.savefig(chart3_path, dpi=150, bbox_inches='tight')
        plt.close(fig3)
        results["artifacts"].append({
            "name": "intent_distribution.png",
            "type": "chart",
            "path": chart3_path
        })
        
        # Summary statistics
        results["summary"] = {
            "total_keywords": len(filtered_df['Keyword'].unique()),
            "branded_traffic": int(category_totals.get('branded', 0)),
            "non_branded_traffic": int(category_totals.get('non-branded', 0)),
            "intent_breakdown": intent_totals.to_dict(),
            "date_range": {
                "start": str(start_month),
                "end": str(end_month)
            }
        }
        
        # Save processed data
        csv_path = os.path.join(output_dir, 'keyword_analysis.csv')
        filtered_df.to_csv(csv_path, index=False)
        results["artifacts"].append({
            "name": "keyword_analysis.csv",
            "type": "csv",
            "path": csv_path
        })
        
        results["success"] = True
        
    except Exception as e:
        results["errors"].append(f"Analysis error: {str(e)}")
    
    return results 