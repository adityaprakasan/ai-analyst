# Channel Analysis Script
# Analyzes traffic by marketing channels (direct, referral, organic/paid search, social, email, display)

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
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

def validate_df_structure(df: pd.DataFrame, required_cols: Set[str], numeric_cols: Set[str]) -> Tuple[bool, List[str]]:
    """Validate CSV structure and data types."""
    errors = []
    
    if not validate_columns(df, required_cols, "file is missing required columns."):
        missing = required_cols - set(df.columns)
        errors.append(f"Missing columns: {', '.join(missing)}")
        return False, errors
    
    # Validate numeric columns
    if not numeric_cols.issubset(required_cols):
        errors.append("Numeric columns not in required columns.")
        return False, errors
    
    for col in numeric_cols:
        if not pd.api.types.is_numeric_dtype(df[col]):
            errors.append(f"{col} column must contain only numbers.")
    
    return len(errors) == 0, errors

def clean_df(raw_df: pd.DataFrame, required_cols: Set[str], numeric_cols: Set[str]) -> Optional[pd.DataFrame]:
    """Clean and process the DataFrame."""
    # Create new DF with required columns
    cleaned_df = raw_df[list(required_cols)].copy()
    
    # Clean columns
    cleaned_df['Target'] = cleaned_df['Target'].str.strip().str.lower()
    for col in numeric_cols:
        cleaned_df[col] = pd.to_numeric(cleaned_df[col], errors='coerce').fillna(0)
    
    # Drop rows where Target is missing
    cleaned_df.dropna(subset=['Target'], inplace=True)
    cleaned_df = cleaned_df[cleaned_df['Target'] != '']
    
    # Drop duplicates
    cleaned_df.drop_duplicates(subset=['Target'], inplace=True)
    
    return cleaned_df.astype({
        'Target': 'string',
        **{col: 'int64' for col in numeric_cols}
    })

def run_analysis(input_file: str, output_dir: str, config: Optional[Dict] = None) -> Dict:
    """Main analysis function for channel analysis."""
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
        ['Target', 'Direct', 'Referral', 'Organic Search', 'Paid Search', 
         'Organic Social', 'Paid Social', 'Email', 'Display Ads']))
    
    numeric_cols = set(config.get('numeric_columns',
        ['Direct', 'Referral', 'Organic Search', 'Paid Search', 
         'Organic Social', 'Paid Social', 'Email', 'Display Ads']))
    
    try:
        # Read CSV
        df = pd.read_csv(input_file)
        
        # Validate
        is_valid, errors = validate_df_structure(df, required_cols, numeric_cols)
        if not is_valid:
            results["errors"] = errors
            return results
        
        # Clean data
        clean_data = clean_df(df, required_cols, numeric_cols)
        if clean_data is None:
            results["errors"].append("Failed to clean data")
            return results
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Create visualizations
        
        # 1. Stacked bar chart by channel
        data_for_plotting = clean_data.set_index('Target').T
        
        fig1, ax1 = plt.subplots(figsize=(12, 8))
        data_for_plotting.plot(
            kind='bar',
            stacked=True,
            ax=ax1,
            color=colors * 3  # Repeat colors as needed
        )
        
        ax1.set_title('Traffic by Channel', fontsize=16, pad=20)
        ax1.set_xlabel('Channel', fontsize=12)
        ax1.set_ylabel('Total Traffic', fontsize=12)
        ax1.tick_params(axis='x', rotation=45)
        ax1.legend(title='Target')
        plt.tight_layout()
        
        chart1_path = os.path.join(output_dir, 'traffic_by_channel.png')
        fig1.savefig(chart1_path, dpi=150, bbox_inches='tight')
        plt.close(fig1)
        results["artifacts"].append({
            "name": "traffic_by_channel.png",
            "type": "chart",
            "path": chart1_path
        })
        
        # 2. Channel mix by target
        data_by_target = clean_data.set_index('Target')
        
        fig2, ax2 = plt.subplots(figsize=(12, 8))
        data_by_target.plot(
            kind='bar',
            stacked=True,
            ax=ax2,
            color=colors * 3
        )
        
        ax2.set_title('Channel Mix by Target', fontsize=16, pad=20)
        ax2.set_xlabel('Target', fontsize=12)
        ax2.set_ylabel('Total Traffic', fontsize=12)
        ax2.tick_params(axis='x', rotation=45)
        ax2.legend(title='Channel')
        plt.tight_layout()
        
        chart2_path = os.path.join(output_dir, 'channel_mix_by_target.png')
        fig2.savefig(chart2_path, dpi=150, bbox_inches='tight')
        plt.close(fig2)
        results["artifacts"].append({
            "name": "channel_mix_by_target.png",
            "type": "chart",
            "path": chart2_path
        })
        
        # 3. Grouped bar chart for comparison
        fig3, ax3 = plt.subplots(figsize=(12, 8))
        data_for_plotting.plot(
            kind='bar',
            ax=ax3,
            color=colors * 3
        )
        
        ax3.set_title('Traffic Comparison by Channel and Target', fontsize=16, pad=20)
        ax3.set_xlabel('Channel', fontsize=12)
        ax3.set_ylabel('Total Traffic', fontsize=12)
        ax3.tick_params(axis='x', rotation=45)
        ax3.legend(title='Target')
        plt.tight_layout()
        
        chart3_path = os.path.join(output_dir, 'channel_comparison.png')
        fig3.savefig(chart3_path, dpi=150, bbox_inches='tight')
        plt.close(fig3)
        results["artifacts"].append({
            "name": "channel_comparison.png",
            "type": "chart",
            "path": chart3_path
        })
        
        # Summary statistics
        channel_totals = {}
        for col in numeric_cols:
            channel_totals[col] = int(clean_data[col].sum())
        
        target_totals = {}
        for idx, row in clean_data.iterrows():
            target_totals[row['Target']] = int(row[list(numeric_cols)].sum())
        
        results["summary"] = {
            "total_traffic": sum(channel_totals.values()),
            "channel_breakdown": channel_totals,
            "target_breakdown": target_totals,
            "top_channel": max(channel_totals, key=channel_totals.get),
            "top_target": max(target_totals, key=target_totals.get) if target_totals else None
        }
        
        # Save processed data
        csv_path = os.path.join(output_dir, 'channel_analysis.csv')
        clean_data.to_csv(csv_path, index=False)
        results["artifacts"].append({
            "name": "channel_analysis.csv",
            "type": "csv",
            "path": csv_path
        })
        
        results["success"] = True
        
    except Exception as e:
        results["errors"].append(f"Analysis error: {str(e)}")
    
    return results 